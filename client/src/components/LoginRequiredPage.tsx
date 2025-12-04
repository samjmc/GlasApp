import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, LogIn, UserPlus } from 'lucide-react';

interface LoginRequiredPageProps {
  title?: string;
  description?: string;
  featureName?: string;
}

/**
 * A friendly page shown when authentication is required
 * Shows a nice message with login/register options instead of a 404
 */
export function LoginRequiredPage({ 
  title = "Sign In Required",
  description,
  featureName = "this feature"
}: LoginRequiredPageProps) {
  const defaultDescription = `Create an account or sign in to access ${featureName}. It only takes a moment!`;
  
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-emerald-200 dark:border-emerald-800 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50">
            <Lock className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {title}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {description || defaultDescription}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          {/* Benefits list */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              With an account, you can:
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Track your political views over time
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Get personalized TD rankings
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Save and share your quiz results
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Participate in daily political sessions
              </li>
            </ul>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </Link>
            
            <Link href="/register">
              <Button variant="outline" className="w-full border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </Button>
            </Link>
          </div>
          
          {/* Continue as guest option */}
          <div className="text-center pt-2">
            <Link href="/">
              <span className="text-sm text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 cursor-pointer">
                ← Continue browsing as guest
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginRequiredPage;

