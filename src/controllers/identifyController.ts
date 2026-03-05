import { Request, Response } from "express";
import { identifyContact } from "../services/contactService";

export async function identifyController(
    req: Request,
    res: Response
): Promise<void> {
    try {
        let { email, phoneNumber } = req.body;

        // Normalize: treat empty strings as null
        if (typeof email === "string" && email.trim() === "") email = null;
        if (typeof phoneNumber === "string" && phoneNumber.trim() === "")
            phoneNumber = null;
        if (email === undefined) email = null;
        if (phoneNumber === undefined) phoneNumber = null;

        // Validate: at least one must be non-null
        if (email === null && phoneNumber === null) {
            res.status(400).json({
                error:
                    "At least one of 'email' or 'phoneNumber' must be provided and non-empty.",
            });
            return;
        }

        const result = await identifyContact(email, phoneNumber);

        res.status(200).json({ contact: result });
    } catch (error) {
        console.error("Error in /identify:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
