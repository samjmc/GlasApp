import React from 'react';
import { Helmet } from 'react-helmet';
import GridHeatmap from '@/components/GridHeatmap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

const UserHeatmapPage: React.FC = () => {
  return (
    <div className="container py-8">
      <Helmet>
        <title>User Opinion Heatmap | Glas Politics</title>
        <meta name="description" content="Explore political opinion trends across Ireland with our interactive 10km x 10km grid heatmap." />
      </Helmet>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Political Opinion Heatmap</h1>
        <p className="text-lg text-muted-foreground">
          Explore how political opinions are distributed across Ireland in a 10km x 10km grid
        </p>
      </div>
      
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <GridHeatmap height={600} title="User Density by Region" />
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About This Map</CardTitle>
              <CardDescription>
                Understanding regional political patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This heatmap displays user density across Ireland using a 10km × 10km grid system. 
                Each cell is colored based on the number of users in that area.
              </p>
              <p className="mb-4">
                We collect anonymous location data during registration to build this visualization, 
                helping everyone understand how political opinions vary by region.
              </p>
              <p>
                Hover over any grid cell to see the exact number of users in that area.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Contribute Your Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This heatmap becomes more accurate as more users share their location data at registration.
              </p>
              <div className="flex flex-col space-y-3">
                <Link href="/register">
                  <Button className="w-full">Create an Account</Button>
                </Link>
                <Link href="/political-compass">
                  <Button variant="outline" className="w-full">Take the Political Quiz</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Regional Political Trends</CardTitle>
          <CardDescription>
            Understanding Ireland's geographic political landscape
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Geographic political patterns reveal important insights about how communities align on key issues.
            By examining density across regions, we can better understand how location influences political views.
          </p>
          <p className="mb-4">
            This visualization helps identify regional political clusters and allows for:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>Identifying areas with high user engagement</li>
            <li>Understanding geographic distribution of political opinions</li>
            <li>Recognizing patterns in political alignment across regions</li>
            <li>Comparing urban vs. rural political sentiment</li>
          </ul>
          <p>
            As more users share their location, this map will become an increasingly valuable resource
            for understanding political geography across Ireland.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserHeatmapPage;