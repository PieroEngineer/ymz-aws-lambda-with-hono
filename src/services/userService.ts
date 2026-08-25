import { deletePreference, putPreference } from "../repositories/userRepository";
import { PreferencePayload } from "../types/users";

export async function saveUserPreference(userId: string, prefId: string, body: PreferencePayload) {
    /**
     * 💡 HINT FOR FUTURE SECURITY/VALIDATION TODO FIX:
     * If you want to enable the validation logic later, you can uncomment this validation guard block:
     * if (!body.title || !body.color) {
     * throw new Error("Title and Color are required");
     * }
     */

    await putPreference(userId, prefId, body);
}

export async function deleteUserPreference(userId: string, prefId: string) {
    await deletePreference(userId, prefId);
}
