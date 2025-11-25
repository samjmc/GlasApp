import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation } from "@/hooks/use-location";

export function LocationDetector() {
  const { location, loading, error, requestLocation, hasPermission } = useLocation();

  return (
    <Card className="w-full max-w-md border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
          <MapPin className="h-5 w-5" />
          Discover Your Area
        </CardTitle>
        <CardDescription className="text-blue-600 dark:text-blue-300">
          See your local representatives and political insights
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!location && !error && (
          <Button 
            onClick={requestLocation} 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding your constituency...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Find My Constituency
              </>
            )}
          </Button>
        )}

        <div className="space-y-3">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            🏛️ View local politicians and their voting records<br/>
            📊 Access constituency-specific insights<br/>
            🎯 Get personalized political analysis
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {location && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-medium text-green-800">Great! We found your area</div>
                <div className="text-xs text-green-600">Now you'll see local political insights</div>
              </div>
            </div>
            
            {location.constituency && (
              <div className="bg-white/50 rounded-lg p-3 border">
                <div className="text-sm font-medium text-blue-800 mb-1">Your Constituency</div>
                <div className="text-lg font-bold text-blue-900">{location.constituency}</div>
                {location.county && (
                  <div className="text-sm text-blue-600">{location.county}</div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Accurate to ±{location.accuracy || 100}m
              </div>
              <Button 
                onClick={requestLocation} 
                variant="ghost" 
                size="sm"
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Update
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          Location data is used to provide personalized constituency insights
        </div>
      </CardContent>
    </Card>
  );
}