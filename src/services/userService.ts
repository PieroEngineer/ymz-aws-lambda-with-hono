import { putUser, deletePreference, putPreference, getUserMetadata } from "../repositories/userRepository.js";
import { PreferencePayload, User } from "../types/users.js";

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

export async function createUser( newUser: User ){
    await putUser( newUser )
}

export async function obtainUserData( userId: string ): Promise<User>{
    return await getUserMetadata(userId)
}