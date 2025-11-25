import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface HistoricalContextProps {
  selectedIdeology?: string;
}

// Historical context and educational content for different political positions
const politicalPositions = {
  economic: {
    left: {
      title: "Economic Left",
      description: "Favors economic policies that prioritize equality, social welfare, and government regulation of markets.",
      history: "Economic left-wing thought in Ireland can be traced back to James Connolly and the early labor movement in the early 20th century. The Irish Labour Party, founded in 1912, has historically represented left-wing economic positions, though its policies have moderated over time.",
      keyFigures: ["James Connolly", "Jim Larkin", "Michael D. Higgins"],
      parties: ["Labour Party", "Sinn Féin", "Social Democrats", "People Before Profit"],
      keyPolicies: [
        "Progressive taxation",
        "Public ownership of key industries",
        "Strong welfare state",
        "Workers' rights and union protections"
      ]
    },
    center: {
      title: "Economic Center",
      description: "Advocates for mixed economic policies that balance market freedom with government regulation and social supports.",
      history: "Centrism in Irish economic policy became prominent in the late 20th century, particularly during the Celtic Tiger era when Ireland embraced a model that combined elements of free market policies with social partnership and EU integration.",
      keyFigures: ["Bertie Ahern", "Garret FitzGerald", "Mary Robinson"],
      parties: ["Fianna Fáil", "Green Party"],
      keyPolicies: [
        "Mixed economy approach",
        "Social partnership",
        "Moderate taxation",
        "Targeted social supports"
      ]
    },
    right: {
      title: "Economic Right",
      description: "Supports free market principles, limited government intervention, and lower taxation.",
      history: "Right-wing economic thought in Ireland gained prominence particularly after joining the European Economic Community in 1973, with Fine Gael often representing more market-oriented approaches. The Progressive Democrats (1985-2009) were known for championing free-market policies and lower taxation.",
      keyFigures: ["Michael McDowell", "Leo Varadkar", "Mary Harney"],
      parties: ["Fine Gael", "Renua Ireland"],
      keyPolicies: [
        "Lower taxation",
        "Reduced regulation",
        "Free trade",
        "Fiscal conservatism"
      ]
    }
  },
  social: {
    progressive: {
      title: "Socially Progressive",
      description: "Advocates for social policies that promote individual freedoms, equality, and societal change.",
      history: "Progressive social policies gained momentum in Ireland particularly from the 1990s onward, accelerating in the 2010s with successful referendums on marriage equality (2015) and reproductive rights (2018), marking significant shifts from Ireland's traditionally conservative Catholic values.",
      keyFigures: ["Mary Robinson", "David Norris", "Katherine Zappone"],
      movements: ["Marriage Equality", "Repeal the 8th", "LGBTQ+ Rights"],
      keyPolicies: [
        "LGBTQ+ rights",
        "Gender equality",
        "Reproductive rights",
        "Separation of church and state"
      ]
    },
    moderate: {
      title: "Socially Moderate",
      description: "Balances traditional values with acceptance of gradual social change and individual rights.",
      history: "Social moderation in Ireland often reflects the transitional period from the 1980s through the 2000s, when the country was moving away from traditional Catholic social teaching but had not yet embraced progressive policies on issues like same-sex marriage or abortion.",
      keyFigures: ["Micheál Martin", "Enda Kenny"],
      parties: ["Modern Fianna Fáil", "Fine Gael (post-2000s)"],
      keyPolicies: [
        "Incremental social reform",
        "Balancing religious heritage with modernization",
        "Moderate approaches to contentious social issues"
      ]
    },
    traditional: {
      title: "Socially Traditional",
      description: "Emphasizes traditional values, often based on religious principles, and is cautious about social change.",
      history: "Traditionally, Irish society was strongly influenced by Catholic social teaching, with the Church playing a dominant role in education, healthcare, and social policy until the late 20th century. Aontú, formed in 2019, represents a modern political expression of socially conservative values.",
      keyFigures: ["Eamon de Valera", "John Charles McQuaid", "Peadar Tóibín"],
      parties: ["Aontú", "Traditional Fianna Fáil"],
      keyPolicies: [
        "Family values based on traditional marriage",
        "Pro-life positions",
        "Religious education",
        "Opposition to euthanasia"
      ]
    }
  },
  issues: {
    housing: {
      title: "Housing Policy",
      description: "Approaches to addressing housing availability, affordability, and homelessness in Ireland.",
      context: "Ireland has faced a significant housing crisis since the mid-2010s, with rising homelessness, soaring rents particularly in Dublin, and difficulties for first-time buyers. This has become one of the country's most pressing political issues.",
      approaches: {
        stateIntervention: {
          title: "State Intervention Approach",
          description: "Advocates for direct government involvement in housing provision, including public housing.",
          parties: ["Sinn Féin", "Labour", "Social Democrats", "People Before Profit"],
          policies: [
            "Large-scale public housing construction",
            "Rent controls and tenant protections",
            "Restrictions on property speculation",
            "Taxation of vacant properties"
          ]
        },
        marketBased: {
          title: "Market-Based Approach",
          description: "Focuses on enabling private developers and the market to address housing needs with limited government intervention.",
          parties: ["Fine Gael", "Some elements of Fianna Fáil"],
          policies: [
            "Developer incentives",
            "Reduced planning restrictions",
            "First-time buyer grants and supports",
            "Encouraging private investment in housing"
          ]
        },
        mixed: {
          title: "Mixed Approach",
          description: "Combines elements of market solutions with targeted government intervention.",
          parties: ["Fianna Fáil", "Green Party"],
          policies: [
            "Public-private partnerships",
            "Affordable housing schemes",
            "Balanced tenant and landlord rights",
            "Sustainable development requirements"
          ]
        }
      }
    },
    immigration: {
      title: "Immigration",
      description: "Perspectives on immigration policy, integration, and multiculturalism in Ireland.",
      context: "Ireland transformed from a country of emigration to one of immigration during the Celtic Tiger era. According to the 2022 census, 22.3% of residents were born outside Ireland. Recent years have seen increased debate about immigration policy and integration.",
      approaches: {
        open: {
          title: "Open Immigration Approach",
          description: "Supports relatively open immigration policies and multicultural integration.",
          parties: ["Green Party", "Labour", "Social Democrats"],
          policies: [
            "Streamlined work visas and residency pathways",
            "Robust integration programs",
            "Support for asylum seekers",
            "Anti-discrimination protections"
          ]
        },
        controlled: {
          title: "Controlled Immigration Approach",
          description: "Advocates for managed immigration systems based primarily on economic needs.",
          parties: ["Fine Gael", "Fianna Fáil"],
          policies: [
            "Points-based immigration system",
            "Skills-based visas",
            "Integration requirements",
            "Balanced approach to asylum"
          ]
        },
        restrictive: {
          title: "Restrictive Immigration Approach",
          description: "Favors significant limitations on immigration and emphasizes national identity concerns.",
          parties: ["National Party", "Irish Freedom Party"],
          policies: [
            "Reduced immigration quotas",
            "Stricter border controls",
            "More stringent asylum policies",
            "Emphasis on assimilation over multiculturalism"
          ]
        }
      }
    },
    eu: {
      title: "EU Relations",
      description: "Perspectives on Ireland's relationship with the European Union.",
      context: "Ireland joined the European Economic Community (now EU) in 1973. EU membership has been transformative for Ireland, providing significant funding for development and access to markets. Ireland's EU policy has generally been pro-integration, though with some controversies around taxation and neutrality.",
      approaches: {
        proIntegration: {
          title: "Pro-Integration Approach",
          description: "Supports deeper European integration and Ireland's active participation in the EU.",
          parties: ["Fine Gael", "Fianna Fáil", "Green Party"],
          policies: [
            "Support for EU common policies",
            "Participation in EU defense initiatives while maintaining neutrality",
            "Deeper economic integration",
            "Strong role in EU institutions"
          ]
        },
        pragmatic: {
          title: "Pragmatic EU Approach",
          description: "Supports EU membership but is cautious about deeper integration in certain areas.",
          parties: ["Labour", "Social Democrats"],
          policies: [
            "Critical engagement with EU economic policies",
            "Protection of Irish taxation sovereignty",
            "Selective opt-ins to EU programs",
            "Reform of EU democratic structures"
          ]
        },
        eurosceptic: {
          title: "Eurosceptic Approach",
          description: "Critical of EU influence and supports limiting or reducing EU powers over Ireland.",
          parties: ["Some elements of Sinn Féin", "Irish Freedom Party"],
          policies: [
            "Opposition to EU fiscal rules",
            "Protection of Irish neutrality",
            "Resistance to tax harmonization",
            "Greater national sovereignty in policy-making"
          ]
        }
      }
    }
  }
};

const HistoricalContext: React.FC<HistoricalContextProps> = ({ selectedIdeology }) => {
  const [activeTab, setActiveTab] = useState<"economic" | "social" | "issues">("economic");
  const [economicPosition, setEconomicPosition] = useState<"left" | "center" | "right">("left");
  const [socialPosition, setSocialPosition] = useState<"progressive" | "moderate" | "traditional">("progressive");
  const [selectedIssue, setSelectedIssue] = useState<"housing" | "immigration" | "eu">("housing");
  
  // Determine initial positions based on selected ideology if provided
  useState(() => {
    if (selectedIdeology) {
      // Logic to set initial positions based on the selected ideology
      // This would map known ideologies to their typical economic and social positions
      if (selectedIdeology.includes("socialist") || selectedIdeology.includes("communist")) {
        setEconomicPosition("left");
        setSocialPosition("progressive");
      } else if (selectedIdeology.includes("liberal")) {
        setEconomicPosition("center");
        setSocialPosition("progressive");
      } else if (selectedIdeology.includes("conservative")) {
        setEconomicPosition("right");
        setSocialPosition("traditional");
      }
      // Add more mappings as needed
    }
  });
  
  return (
    <Card className="w-full bg-white dark:bg-gray-800 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Political Perspectives & Historical Context</CardTitle>
        <CardDescription>
          Explore the historical context and educational content about different political positions in Ireland.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="mb-4 grid grid-cols-3">
            <TabsTrigger value="economic">Economic Perspectives</TabsTrigger>
            <TabsTrigger value="social">Social Perspectives</TabsTrigger>
            <TabsTrigger value="issues">Key Issues</TabsTrigger>
          </TabsList>
          
          {/* Economic Perspectives Tab */}
          <TabsContent value="economic" className="space-y-4">
            <div className="grid grid-cols-3 gap-2 mb-6">
              <Button 
                variant={economicPosition === "left" ? "default" : "outline"}
                onClick={() => setEconomicPosition("left")}
                className="w-full"
              >
                Left
              </Button>
              <Button 
                variant={economicPosition === "center" ? "default" : "outline"}
                onClick={() => setEconomicPosition("center")}
                className="w-full"
              >
                Center
              </Button>
              <Button 
                variant={economicPosition === "right" ? "default" : "outline"}
                onClick={() => setEconomicPosition("right")}
                className="w-full"
              >
                Right
              </Button>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{politicalPositions.economic[economicPosition].title}</h3>
              <p className="text-gray-700 dark:text-gray-300">
                {politicalPositions.economic[economicPosition].description}
              </p>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history">
                  <AccordionTrigger>Historical Context</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-700 dark:text-gray-300">
                      {politicalPositions.economic[economicPosition].history}
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="figures">
                  <AccordionTrigger>Key Figures</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {politicalPositions.economic[economicPosition].keyFigures.map((figure, index) => (
                        <li key={index}>{figure}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="parties">
                  <AccordionTrigger>Associated Parties</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {politicalPositions.economic[economicPosition].parties.map((party, index) => (
                        <li key={index}>{party}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="policies">
                  <AccordionTrigger>Key Policies</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {politicalPositions.economic[economicPosition].keyPolicies.map((policy, index) => (
                        <li key={index}>{policy}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
          
          {/* Social Perspectives Tab */}
          <TabsContent value="social" className="space-y-4">
            <div className="grid grid-cols-3 gap-2 mb-6">
              <Button 
                variant={socialPosition === "progressive" ? "default" : "outline"}
                onClick={() => setSocialPosition("progressive")}
                className="w-full"
              >
                Progressive
              </Button>
              <Button 
                variant={socialPosition === "moderate" ? "default" : "outline"}
                onClick={() => setSocialPosition("moderate")}
                className="w-full"
              >
                Moderate
              </Button>
              <Button 
                variant={socialPosition === "traditional" ? "default" : "outline"}
                onClick={() => setSocialPosition("traditional")}
                className="w-full"
              >
                Traditional
              </Button>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{politicalPositions.social[socialPosition].title}</h3>
              <p className="text-gray-700 dark:text-gray-300">
                {politicalPositions.social[socialPosition].description}
              </p>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="history">
                  <AccordionTrigger>Historical Context</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-gray-700 dark:text-gray-300">
                      {politicalPositions.social[socialPosition].history}
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="figures">
                  <AccordionTrigger>Key Figures</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {politicalPositions.social[socialPosition].keyFigures.map((figure, index) => (
                        <li key={index}>{figure}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="movements">
                  <AccordionTrigger>
                    {socialPosition === "progressive" ? "Key Movements" : "Associated Parties"}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {socialPosition === "progressive" 
                        ? politicalPositions.social[socialPosition].movements.map((movement, index) => (
                            <li key={index}>{movement}</li>
                          ))
                        : politicalPositions.social[socialPosition].parties.map((party, index) => (
                            <li key={index}>{party}</li>
                          ))
                      }
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="policies">
                  <AccordionTrigger>Key Policies</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      {politicalPositions.social[socialPosition].keyPolicies.map((policy, index) => (
                        <li key={index}>{policy}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
          
          {/* Key Issues Tab */}
          <TabsContent value="issues" className="space-y-4">
            <div className="grid grid-cols-3 gap-2 mb-6">
              <Button 
                variant={selectedIssue === "housing" ? "default" : "outline"}
                onClick={() => setSelectedIssue("housing")}
                className="w-full"
              >
                Housing
              </Button>
              <Button 
                variant={selectedIssue === "immigration" ? "default" : "outline"}
                onClick={() => setSelectedIssue("immigration")}
                className="w-full"
              >
                Immigration
              </Button>
              <Button 
                variant={selectedIssue === "eu" ? "default" : "outline"}
                onClick={() => setSelectedIssue("eu")}
                className="w-full"
              >
                EU Relations
              </Button>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{politicalPositions.issues[selectedIssue].title}</h3>
              <p className="text-gray-700 dark:text-gray-300">
                {politicalPositions.issues[selectedIssue].description}
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mb-4">
                <h4 className="font-medium mb-2">Historical Context</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {politicalPositions.issues[selectedIssue].context}
                </p>
              </div>
              
              <h4 className="font-medium mb-2">Political Approaches</h4>
              
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(politicalPositions.issues[selectedIssue].approaches).map(([key, approach]) => (
                  <AccordionItem value={key} key={key}>
                    <AccordionTrigger>{approach.title}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-gray-700 dark:text-gray-300 mb-3">
                        {approach.description}
                      </p>
                      
                      <h5 className="font-medium mt-3 mb-2">Associated Parties</h5>
                      <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 mb-3">
                        {approach.parties.map((party, index) => (
                          <li key={index}>{party}</li>
                        ))}
                      </ul>
                      
                      <h5 className="font-medium mt-3 mb-2">Key Policies</h5>
                      <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                        {approach.policies.map((policy, index) => (
                          <li key={index}>{policy}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default HistoricalContext;