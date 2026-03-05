import prisma from "../db/prismaClient";
import { Contact } from "@prisma/client";

const PRIMARY = "primary";
const SECONDARY = "secondary";

interface IdentifyResult {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
}

/**
 * Main identity reconciliation logic.
 * Links customer contact info across purchases.
 */
export async function identifyContact(
    email: string | null,
    phoneNumber: string | null
): Promise<IdentifyResult> {
    // Step 2: Query existing contacts matching email or phone
    const whereConditions: any[] = [];
    if (email) {
        whereConditions.push({ email });
    }
    if (phoneNumber) {
        whereConditions.push({ phoneNumber });
    }

    const matchedContacts = await prisma.contact.findMany({
        where: {
            deletedAt: null,
            OR: whereConditions,
        },
        orderBy: { createdAt: "asc" },
    });

    // Case A: No matches — create new primary
    if (matchedContacts.length === 0) {
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: PRIMARY,
            },
        });
        return buildResponse([newContact]);
    }

    // Case B: Gather the full cluster
    // Find all root primaries
    const rootPrimaryIds = new Set<number>();
    for (const contact of matchedContacts) {
        if (contact.linkPrecedence === PRIMARY) {
            rootPrimaryIds.add(contact.id);
        } else if (contact.linkedId !== null) {
            rootPrimaryIds.add(contact.linkedId);
        }
    }

    // Case D: If two or more separate primaries are found, merge them
    if (rootPrimaryIds.size > 1) {
        await mergePrimaryClusters(rootPrimaryIds);
    }

    // Fetch all root primaries (some may have been updated by merge)
    const primaries = await prisma.contact.findMany({
        where: {
            id: { in: Array.from(rootPrimaryIds) },
            deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
    });

    // After a merge, the true root primary is the oldest one
    const rootPrimary = primaries.find((p) => p.linkPrecedence === PRIMARY);
    if (!rootPrimary) {
        // Fallback: if all were merged, re-fetch the oldest by tracing linkedId
        const oldest = primaries.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )[0];
        const trueRootId = oldest.linkedId ?? oldest.id;
        return identifyFromRoot(trueRootId, email, phoneNumber);
    }

    return identifyFromRoot(rootPrimary.id, email, phoneNumber);
}

/**
 * Given a root primary ID, fetch the full cluster,
 * optionally create a secondary if new info is present,
 * and build the response.
 */
async function identifyFromRoot(
    rootPrimaryId: number,
    email: string | null,
    phoneNumber: string | null
): Promise<IdentifyResult> {
    // Fetch full cluster: the primary + all its secondaries
    let cluster = await prisma.contact.findMany({
        where: {
            deletedAt: null,
            OR: [{ id: rootPrimaryId }, { linkedId: rootPrimaryId }],
        },
        orderBy: { createdAt: "asc" },
    });

    // Case E & C: check if request has new information
    const clusterEmails = new Set(
        cluster.map((c) => c.email).filter(Boolean)
    );
    const clusterPhones = new Set(
        cluster.map((c) => c.phoneNumber).filter(Boolean)
    );

    const hasNewEmail = email !== null && !clusterEmails.has(email);
    const hasNewPhone = phoneNumber !== null && !clusterPhones.has(phoneNumber);

    if (hasNewEmail || hasNewPhone) {
        // Case C: Create a new secondary with the new info
        const newSecondary = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: rootPrimaryId,
                linkPrecedence: SECONDARY,
            },
        });
        cluster.push(newSecondary);
    }

    // Case E: exact duplicate — no new rows, just return
    return buildResponse(cluster);
}

/**
 * Merge multiple primary clusters under the oldest primary.
 * The oldest keeps primary status; newer primaries become secondaries,
 * and all their secondaries get re-linked.
 */
async function mergePrimaryClusters(
    rootPrimaryIds: Set<number>
): Promise<void> {
    const primaries = await prisma.contact.findMany({
        where: {
            id: { in: Array.from(rootPrimaryIds) },
            deletedAt: null,
        },
        orderBy: { createdAt: "asc" },
    });

    if (primaries.length <= 1) return;

    const oldest = primaries[0];
    const toMerge = primaries.slice(1);

    for (const newer of toMerge) {
        // Downgrade the newer primary to secondary
        await prisma.contact.update({
            where: { id: newer.id },
            data: {
                linkedId: oldest.id,
                linkPrecedence: SECONDARY,
            },
        });

        // Re-link all secondaries of the newer primary to the oldest
        await prisma.contact.updateMany({
            where: {
                linkedId: newer.id,
                deletedAt: null,
            },
            data: {
                linkedId: oldest.id,
            },
        });
    }
}

/**
 * Build the API response from a contact cluster.
 * Primary info comes first; arrays are deduplicated with nulls removed.
 */
function buildResponse(cluster: Contact[]): IdentifyResult {
    const primary = cluster.find((c) => c.linkPrecedence === PRIMARY)!;
    const secondaries = cluster.filter((c) => c.linkPrecedence === SECONDARY);

    // Build emails: primary first, then secondaries, deduplicated
    const emails: string[] = [];
    if (primary.email) emails.push(primary.email);
    for (const s of secondaries) {
        if (s.email && !emails.includes(s.email)) {
            emails.push(s.email);
        }
    }

    // Build phoneNumbers: primary first, then secondaries, deduplicated
    const phoneNumbers: string[] = [];
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
    for (const s of secondaries) {
        if (s.phoneNumber && !phoneNumbers.includes(s.phoneNumber)) {
            phoneNumbers.push(s.phoneNumber);
        }
    }

    // Secondary IDs sorted
    const secondaryContactIds = secondaries
        .map((s) => s.id)
        .sort((a, b) => a - b);

    return {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
    };
}
