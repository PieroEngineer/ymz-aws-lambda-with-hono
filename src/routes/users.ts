import { Hono } from "hono";
import { createUser, deleteUserPreference, obtainUserData, saveUserPreference } from "../services/userService.js";
import { PreferencePayload, User, UserCreationPayload, UserDataResponse } from "../types/users.js";

// 📦 Create an isolated, modular sub-router for /users routes
export const usersRouter = new Hono();

usersRouter.post("/:userId/create", async (c) => {
  // TODO: Here the restaurant is initialized with the default values when the restaurant register
  try {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const body: UserCreationPayload = await c.req.json().catch(() => ({}));

    const newUser: User = { // TODO: Move to mapper
      userId: userId,
      username: body.username,
      creationTimestamp: Date.now()
    }

    await createUser( newUser );

    return c.json({ message: "✅  User created successfully" }, 200);

  }
  catch (error: any) {
    console.error(`🚨 USER CREATION ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }

});

usersRouter.get("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const user = await obtainUserData(userId);

    const userDataResponse: UserDataResponse = {
      username: user.username
    };

    return c.json(userDataResponse, 200);
  } catch (error: any) {
    console.error(`🚨 USER RETRIEVAL ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Save or update a user preferences entity
 * PATH: PUT /users/:userId/preferences/:prefId
 */
usersRouter.put("/:userId/preferences/:prefId", async (c) => {
  try {
    // 🗺️ Extract context routing path variables cleanly
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");

    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }

    // 📩 Parse input payload safely from Hono context body
    const body: PreferencePayload = await c.req.json().catch(() => ({}));

    await saveUserPreference(user_id, pref_id, body);

    console.log(`✅🙋 The preference ${pref_id} for user ${user_id} was successfully added`);
    return c.json({ message: "Preference saved successfully" }, 200);

  } catch (error: any) {
    console.error(`🚩 USER PREF PUT ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Erase a targeted user preference block
 * PATH: DELETE /users/:userId/preferences/:prefId
 */
usersRouter.delete("/:userId/preferences/:prefId", async (c) => {
  try {
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");

    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }

    await deleteUserPreference(user_id, pref_id);

    console.log(`✅🗑️ The preference ${pref_id} of user ${user_id} was successfully deleted`);
    
    // 📭 Return true 204 No Content with empty body standard payload
    return c.body(null, 204);

  } catch (error: any) {
    console.error(`🚩 USER PREF DELETE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
