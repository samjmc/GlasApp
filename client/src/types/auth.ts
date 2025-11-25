export interface ReplitUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  displayName?: string;
}

export interface AuthContextType {
  user: ReplitUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}