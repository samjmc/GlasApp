import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { LogIn, LogOut, User, Settings } from 'lucide-react';

export function AuthButton() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled>
          <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin" />
          Loading...
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button 
          onClick={() => setLocation('/login')} 
          className="justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex items-center gap-2 bg-[#67e6a9]"
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </Button>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout?.();
      setLocation('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || ''} alt={user?.displayName || 'User'} />
            <AvatarFallback>
              {user?.firstName ? user.firstName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium">
            {user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          {user?.email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation('/profile')}>
          <User className="w-4 h-4 mr-2" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation('/settings')}>
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}