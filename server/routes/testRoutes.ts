import { storage } from "../storage";

export async function testRoute() {
  // This will trigger Check 2 failure: undefined method
  const user = await storage.getTestUser("test-id");
  return user;
}
