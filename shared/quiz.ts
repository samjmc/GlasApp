/**
 * The political quiz: the ONE question bank, shared by the server (which scores it) and the
 * client (which shows it). Values follow shared/ideology.ts: + is the right-coded pole.
 *
 * Each question measures ONE dimension, and each answer carries one `value` on it. Larger
 * magnitude = a stronger stance. Scoring (server/quiz/score.ts) normalises per dimension, so
 * the values set the relative strength of answers, not the final scale. Answer ids are array
 * positions, 0..3.
 *
 * History (2026-09-24): moved from shared/enhanced-quiz-data.ts with globalism, environmental
 * and welfare negated into the shared sign rule, the unscored "Strategic Compass" question
 * dropped, and technocratic re-read answer by answer (Q23 negated, Q25 answers 2 and 4
 * negated), and six answers re-weighted where a milder stance scored the same as the
 * strongest (Q14, Q16, Q17 ×2, Q20) or the strongest scored as mild (Q19).
 * 2026-09-25: Q6 (healthcare, public vs private) moved from social to economic with four
 * levels; Q27 (assisted dying) added so social keeps three questions; Q5 "devolve to local
 * boards" and Q9 "citizens' vote" cut from strong to mild (they are procedures, not values);
 * Q15 small modular reactors cut to mild; Q22 "relocate with tax reliefs" raised to the
 * strongest self-reliance answer.
 * 2026-09-26: the pool grows to 6 questions per dimension, 48 in all. Ids 28–49 are new (28
 * economic, then three each on social, cultural, authority, environmental, welfare, globalism,
 * technocratic); id 26 stays unused. Each new question has the symmetric values −S, −M, +M, +S
 * (2.5/1.25 on economic, 3.33/1.67 elsewhere). Existing answers recoded in place, text unchanged:
 * Q14 "Allow offsets through forestry…", Q15 "Back green gas and carbon capture…" and Q16 "Drop
 * the charge idea…" from −1.67 to +1.67, so each environmental question has a mild pro-growth
 * answer (a mild pro-growth user was put on the wrong side by seed alone); Q4 "Offer targeted
 * rebates…" from −1.25 to +1.25 (it keeps market prices and helps with income, like the strong
 * market answer); Q7 "Pass it with tailored conscience clauses…" from +1.67 to −1.67 (it passes
 * the rights bill).
 * The old answers also carried an eight-axis vector; 456 of its 520 off-axis values were the
 * same stock ±1.67/±3.33, nothing scored them, and they were removed.
 */
import type { IdeologyDimension, IdeologyVector } from './ideology';

export interface QuizAnswer {
  /** Position on the question's own dimension; + is the right-coded pole. */
  value: number;
  text: string;
  description: string;
}

export interface QuizQuestion {
  id: number;
  dimension: IdeologyDimension;
  text: string;
  answers: QuizAnswer[];
}

/** One answer as the client sends it: the question id and the chosen answer's index. */
export interface QuizResponse {
  questionId: number;
  answerIndex: number;
}

/** What the server returns for a scored quiz, saved or not. */
export interface QuizResult {
  id: number | null;
  vector: IdeologyVector;
  ideology: string;
  description: string;
  answeredCount: number;
  createdAt: string | null;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    dimension: 'economic',
    text: "How should a €3bn budget surplus be used when only one priority can be funded?",
    answers: [
      { value: -2.5, text: "Accelerate national infrastructure like transport and housing even if debt rises short term", description: "Back a state-led building surge that keeps timelines tight and national outcomes front of mind." },
      { value: -2.5, text: "Expand targeted social supports such as healthcare cost relief and income floors", description: "Channel the windfall into safety-net programmes designed around the most vulnerable households." },
      { value: 2.5, text: "Deliver broad-based tax relief so households and SMEs feel an immediate dividend", description: "Return the surplus directly to earners and firms to stimulate private choice and investment." },
      { value: 1.25, text: "Bank the funds in a resilience reserve for future shocks and major contingencies", description: "Keep powder dry and let experts deploy the capital when a strategic threat or opportunity appears." },
    ],
  },
  {
    id: 2,
    dimension: 'economic',
    text: "With global tax rules shifting, what should Ireland do about its corporate tax model?",
    answers: [
      { value: 2.5, text: "Hold the 12.5% rate and double down on competitiveness to keep multinationals anchored", description: "Stick with the classic playbook: low rates, fast approvals, and a pro-investment signal to boardrooms." },
      { value: 1.25, text: "Accept the EU minimum rate but swap in generous R&D and green innovation credits", description: "Split the difference: comply with new floors while sharpening targeted incentives for high-value jobs." },
      { value: -2.5, text: "Raise headline rates and recycle the revenue into domestic innovation funds and apprenticeships", description: "Ask corporates to pay more, then plough it into home-grown capacity and future-ready skills." },
      { value: -2.5, text: "Pivot from tax competition entirely and scale state-led strategic industries", description: "Build sovereign capabilities first and treat the tax model as a bridge to a more self-directed economy." },
    ],
  },
  {
    id: 3,
    dimension: 'economic',
    text: "A €10bn rail upgrade can be done via private partnerships or the exchequer. How do you deliver?",
    answers: [
      { value: 2.5, text: "Use a regulated PPP so private operators build and run services under state oversight", description: "Blend market efficiency with accountability while keeping fares and service quality in check." },
      { value: -2.5, text: "Borrow and build entirely through a state agency to keep ownership and fares public", description: "Own every asset, accept higher national debt, and guarantee public-interest delivery." },
      { value: -1.25, text: "Run a hybrid: state constructs core lines, specialists operate the add-ons under contract", description: "Split responsibilities to keep strategic control while leveraging private expertise where it helps." },
      { value: 1.25, text: "Defer the project and focus on smaller upgrades until fiscal space grows", description: "Press pause, prioritise stability, and avoid a mega-project until conditions are perfect." },
    ],
  },
  {
    id: 4,
    dimension: 'economic',
    text: "Wholesale energy prices spike 40% overnight. What intervention feels right?",
    answers: [
      { value: -2.5, text: "Impose a universal price cap funded by borrowing so every household is shielded", description: "Freeze energy bills across the board and ask the state to absorb the volatility." },
      { value: 1.25, text: "Offer targeted rebates for low-income homes and critical SMEs only", description: "Protect those most exposed, keep overall price signals intact, and limit fiscal damage." },
      { value: -1.25, text: "Keep market prices but tier tariffs to reward conservation and retrofit investment", description: "Let prices bite, then help people who cut demand or upgrade to efficient systems." },
      { value: 2.5, text: "Avoid distortion, allow prices to settle, and help via income supports or business relief", description: "Respect market signals, trust households to adjust, and cushion income instead of price." },
    ],
  },
  {
    id: 6,
    dimension: 'economic',
    text: "Sláintecare is behind schedule. Which system reset do you back?",
    answers: [
      { value: -2.5, text: "Move rapidly to a fully public system with state-run hospitals and clinics", description: "Make healthcare a universal public service, even if it means major structural upheaval." },
      { value: -1.25, text: "Keep a mixed system but cap private profits and embed regulated waiting-time guarantees", description: "Hold on to choice while tightening the rules to ensure universal access in practice." },
      { value: 1.25, text: "Lean into mandatory basic insurance with private providers competing on top-up care", description: "Mandate coverage for all, but keep insurers and hospitals market-driven within rules." },
      { value: 2.5, text: "Shift to vouchers that citizens can spend in public or private facilities as they see fit", description: "Fund people instead of systems so patient choice forces quality improvements." },
    ],
  },
  {
    id: 28,
    dimension: 'economic',
    text: "Ireland needs far more new homes. Who should build them?",
    answers: [
      { value: -2.5, text: "A new state construction company, building homes directly and selling or renting them at cost", description: "Take the developer's profit out of the price and build at the scale the country needs." },
      { value: -1.25, text: "The Land Development Agency, commissioning more homes on public land from private builders", description: "Keep public land in public hands and decide what gets built, while contractors do the building." },
      { value: 1.25, text: "Private developers, with the state buying or leasing homes where it needs them", description: "Use the state's buying power to support supply without taking on construction risk itself." },
      { value: 2.5, text: "Private developers alone, once planning delays, levies and building costs are cut", description: "Competition and lower costs, not the state, will bring prices down." },
    ],
  },
  {
    id: 5,
    dimension: 'social',
    text: "Citizenship education is being rewritten. What emphasis should the curriculum carry?",
    answers: [
      { value: -3.33, text: "Champion rights, diversity, and inclusive histories in every classroom", description: "Double down on equality, minority experiences, and the social movements that shaped Ireland." },
      { value: 1.67, text: "Blend modern citizenship with space for heritage, faith schools, and ethical debates", description: "Balance pluralism with continuity so schools mirror the country’s layered identity." },
      { value: -1.67, text: "Keep the focus practical: media literacy, civic participation, and digital citizenship", description: "Equip students with critical thinking tools more than ideology-laden content." },
      { value: 1.67, text: "Devolve content to local school boards within light national guardrails", description: "Let communities steer the tone while the state only defines core competencies." },
    ],
  },
  {
    id: 7,
    dimension: 'social',
    text: "A new personal freedoms bill expands speech, assembly, and reproductive rights. Without tweaks?",
    answers: [
      { value: -3.33, text: "Pass it exactly as drafted; rights come first even if some groups are uneasy", description: "Lock in strong protections and trust society to adapt to a broader rights framework." },
      { value: -1.67, text: "Pass it with tailored conscience clauses for faith-based organisations", description: "Safeguard liberties while giving sincere objectors a legal path to opt out." },
      { value: 1.67, text: "Pause for a national consultation and redraft once the public has weighed in", description: "Seek a broader mandate and slow down rather than risk polarising the debate." },
      { value: 3.33, text: "Reject it; existing legal protections already strike the right balance", description: "Avoid what feels like social engineering and stick with the current settlement." },
    ],
  },
  {
    id: 27,
    dimension: 'social',
    text: "Assisted dying for terminally ill adults is back before the Oireachtas. What should happen?",
    answers: [
      { value: -3.33, text: "Legislate now for terminally ill adults, with strict medical safeguards", description: "Treat the choice over how a terminal illness ends as a personal right the law should respect." },
      { value: -1.67, text: "Legislate, but only after a citizens' assembly sets narrow limits", description: "Move towards a legal option carefully, with tight eligibility and a broad public mandate." },
      { value: 1.67, text: "Invest in palliative care first and revisit the question in a few years", description: "Make sure no one feels pushed towards assisted death because good end-of-life care is missing." },
      { value: 3.33, text: "Keep the current ban; the state should never help end a life", description: "Hold to the principle that the law protects life in every circumstance." },
    ],
  },
  {
    id: 29,
    dimension: 'social',
    text: "Should the law make a woman wait a set number of days between a first consultation and an early abortion?",
    answers: [
      { value: -3.33, text: "No; drop any mandatory wait and trust women and their doctors on timing", description: "The decision is usually made before she sees a doctor; a forced wait only adds cost and stress." },
      { value: -1.67, text: "Keep a short wait, but let doctors waive it where delay would cause harm or hardship", description: "Allow time to reflect, but never let a fixed rule push care past a deadline." },
      { value: 1.67, text: "Yes; a three-day wait gives every woman time to reflect", description: "A short pause before an irreversible decision is a reasonable safeguard." },
      { value: 3.33, text: "Yes, and make it longer, with counselling required first", description: "The law should do more to make sure every alternative has been considered." },
    ],
  },
  {
    id: 30,
    dimension: 'social',
    text: "Most Irish primary schools are under Catholic patronage. Should that change?",
    answers: [
      { value: -3.33, text: "Yes; move many schools to multi-denominational patrons on a firm national timetable", description: "Publicly funded schools should serve children of every faith and none on equal terms." },
      { value: -1.67, text: "Yes, school by school, wherever local parents vote for a new patron", description: "Change should come when a community asks for it." },
      { value: 1.67, text: "Keep existing patrons, and add multi-denominational schools only where demand is shown", description: "Widen choice without taking schools from the communities that built them." },
      { value: 3.33, text: "No; keep patronage as it is and protect each school's religious ethos", description: "Faith-based education is what many families want, and it serves them well." },
    ],
  },
  {
    id: 31,
    dimension: 'social',
    text: "How should Irish law treat surrogacy, where a woman carries a child for someone else?",
    answers: [
      { value: -3.33, text: "Allow it, including paid arrangements, and recognise the parents of children born through surrogacy abroad", description: "Adults should be free to build families this way, and the law should protect the children born." },
      { value: -1.67, text: "Allow unpaid surrogacy, and recognise unpaid arrangements made abroad under strict safeguards", description: "Support families formed this way while keeping money out of it." },
      { value: 1.67, text: "Allow only unpaid surrogacy arranged in Ireland, under close court supervision", description: "Proceed with caution and keep every case under Irish oversight." },
      { value: 3.33, text: "Do not allow it; carrying a child for someone else should not be permitted", description: "Surrogacy risks treating women and children as a means to an end." },
    ],
  },
  {
    id: 8,
    dimension: 'cultural',
    text: "How should Ireland support both Gaeilge and migrant integration in communities?",
    answers: [
      { value: 3.33, text: "Double Irish-language investment and require structured cultural induction for newcomers", description: "Put heritage front and centre while ensuring everyone understands shared cultural references." },
      { value: 1.67, text: "Maintain current support, focus integration on employment pathways and practical services", description: "Keep language supports steady but prioritise labour market access for new arrivals." },
      { value: -1.67, text: "Fund community-led projects pairing Irish-language groups with migrant organisations", description: "Let local partnerships define culture-building so everyone sees themselves in the programme." },
      { value: -3.33, text: "Shift emphasis to shared civic values and lighten direct state heritage promotion", description: "Focus resources on a common civic identity instead of state-led cultural preservation." },
    ],
  },
  {
    id: 9,
    dimension: 'cultural',
    text: "A historic quarter is needed for new housing supply. What planning call do you make?",
    answers: [
      { value: -3.33, text: "Rezone aggressively; densify even if beloved buildings disappear", description: "Housing shortage trumps preservation—move fast and accept cultural trade-offs." },
      { value: 1.67, text: "Preserve exteriors but allow adaptive reuse inside once heritage is documented", description: "Protect the streetscape while modernising interiors for homes and services." },
      { value: 3.33, text: "Redirect development to another area and keep the historic fabric intact", description: "Respect the quarter as a national asset and find housing capacity elsewhere." },
      { value: 1.67, text: "Stage a citizens’ vote; proceed only with a clear democratic mandate", description: "Let local residents and the wider public decide before anything irreversible happens." },
    ],
  },
  {
    id: 10,
    dimension: 'cultural',
    text: "Arts funding is being cut. Which philosophy keeps creative life vibrant?",
    answers: [
      { value: 3.33, text: "Protect national institutions first; make sure landmark orchestras and theatres survive", description: "Keep the cultural flagships strong even if grassroots projects feel the squeeze." },
      { value: -3.33, text: "Prioritise community arts, emerging voices, and contemporary Irish stories", description: "Back the next generation, new media, and local access over elite institutions." },
      { value: 1.67, text: "Tie grants to economic impact, tourism appeal, and measurable reach", description: "Fund the projects with the clearest return—jobs, visitors, and national promotion." },
      { value: 1.67, text: "Scale back state involvement and invite philanthropy or private patronage", description: "Let markets and donors decide what art thrives rather than Treasury allocations." },
    ],
  },
  {
    id: 32,
    dimension: 'cultural',
    text: "RTÉ broadcasts the Angelus every day on radio and television. Should it continue?",
    answers: [
      { value: -3.33, text: "No; a public broadcaster should not air a Catholic call to prayer", description: "RTÉ serves a diverse country and should not favour one faith." },
      { value: -1.67, text: "Replace it with a short moment of reflection for people of all faiths and none", description: "Keep a daily pause, but make it one everyone can share." },
      { value: 1.67, text: "Yes; it is a brief, familiar pause that bothers few people", description: "It is part of the rhythm of Irish life and does no harm." },
      { value: 3.33, text: "Yes, and protect it as part of the national heritage", description: "Traditions like this should be safeguarded, not debated away." },
    ],
  },
  {
    id: 33,
    dimension: 'cultural',
    text: "Irish is compulsory for most students up to the Leaving Certificate. Should it stay that way?",
    answers: [
      { value: -3.33, text: "No; make Irish optional after the Junior Cycle", description: "Let students choose; compulsion breeds resentment, not fluency." },
      { value: -1.67, text: "Keep it compulsory, but widen exemptions and offer a lighter course for those who struggle", description: "Keep Irish for all while easing the pressure on students who find it hardest." },
      { value: 1.67, text: "Yes; keep it compulsory as it is now", description: "Every student should leave school with a real connection to the national language." },
      { value: 3.33, text: "Yes, and teach more subjects through Irish", description: "Compulsion alone is not enough; Irish should be a living language in every school." },
    ],
  },
  {
    id: 34,
    dimension: 'cultural',
    text: "When councils name new streets, bridges and public spaces, whose stories should the names tell?",
    answers: [
      { value: -3.33, text: "Today's diverse Ireland, including people from newer communities", description: "Public names should reflect everyone who lives here now." },
      { value: -1.67, text: "A mix chosen by open public nomination, with newer voices alongside familiar Irish figures", description: "Let the public choose from a wider range of people." },
      { value: 1.67, text: "Mainly people and places from Irish history", description: "Names should connect people to the country's own story." },
      { value: 3.33, text: "Only Irish place names, saints and national figures rooted in local heritage", description: "Public names are part of the national inheritance and should stay rooted in it." },
    ],
  },
  {
    id: 11,
    dimension: 'globalism',
    text: "Ireland is asked to join an EU rapid-response defence force. What's your instinct?",
    answers: [
      { value: -3.33, text: "Join fully; collective security outweighs neutrality concerns in today's threat landscape", description: "Step into shared defence, accept joint command, and deepen European solidarity." },
      { value: -1.67, text: "Join for logistics, cyber, and intelligence while keeping combat neutrality", description: "Support allies behind the scenes and build capability without crossing combat red lines." },
      { value: 3.33, text: "Decline politely and double down on UN peacekeeping instead", description: "Protect neutrality, stay trusted in conflict mediation, and avoid permanent alliances." },
      { value: 1.67, text: "Hold a referendum before any commitment of forces or funding", description: "Let the electorate decide if neutrality should evolve and respect the result." },
    ],
  },
  {
    id: 12,
    dimension: 'globalism',
    text: "The EU wants unified agricultural policy to hit climate targets. Where do you land?",
    answers: [
      { value: -3.33, text: "Support full harmonisation; shared standards protect exports and climate commitments", description: "Align with Brussels on regulation, even if it constrains domestic policy freedom." },
      { value: -1.67, text: "Back it with opt-outs for sectors where Ireland is uniquely exposed", description: "Integrate broadly but fight for carve-outs that recognise Irish agriculture realities." },
      { value: 3.33, text: "Oppose centralisation; keep national control of agri policy to protect producers", description: "Trust local knowledge and resist EU encroachment on a pillar industry." },
      { value: 3.33, text: "Devolve decisions further to regions and farmer co-ops, not Brussels or Dublin", description: "Empower those on the ground to lead, keeping higher tiers of government out of it." },
    ],
  },
  {
    id: 13,
    dimension: 'globalism',
    text: "The UN asks Ireland to double its refugee intake within three years. What's credible?",
    answers: [
      { value: -3.33, text: "Agree and expand integration services nationwide immediately", description: "Honor humanitarian responsibilities and build capacity quickly across the state." },
      { value: -1.67, text: "Accept but phase quotas with clear housing and service milestones", description: "Meet the challenge gradually so infrastructure keeps pace with arrivals." },
      { value: 1.67, text: "Hold intake steady and ramp up aid closer to conflict zones instead", description: "Support refugees abroad and prioritise domestic capacity constraints at home." },
      { value: 3.33, text: "Decline; national resources are already stretched and community patience is thin", description: "Protect domestic stability first and signal that Ireland has reached its limit." },
    ],
  },
  {
    id: 44,
    dimension: 'globalism',
    text: "The EU negotiates trade deals for all its members, including Ireland. What should Ireland push for?",
    answers: [
      { value: -3.33, text: "More and deeper free-trade deals; open markets are how a small exporting country prospers", description: "Ireland's jobs depend on selling to the world." },
      { value: -1.67, text: "Keep signing deals, with binding protections for food standards and sensitive sectors", description: "Trade openly, but on fair terms." },
      { value: 1.67, text: "Slow down new deals and shield sensitive sectors like beef before opening further", description: "Protect what matters at home before chasing new markets." },
      { value: 3.33, text: "Oppose deals that expose Irish farmers and firms to cheaper imports; put domestic producers first", description: "Irish producers should not be traded away for access elsewhere." },
    ],
  },
  {
    id: 45,
    dimension: 'globalism',
    text: "Ireland has long been committed to the UN target of spending 0.7% of national income on overseas aid, and is still short of it. What should it do?",
    answers: [
      { value: -3.33, text: "Reach 0.7% quickly, and then go beyond it", description: "As a wealthy country, Ireland has a duty to help the world's poorest." },
      { value: -1.67, text: "Reach 0.7% gradually, step by step in each budget", description: "Keep the commitment at a pace the public finances can bear." },
      { value: 1.67, text: "Hold aid at today's level until pressures at home ease", description: "Needs at home, like housing and health, should come first for now." },
      { value: 3.33, text: "Cut overseas aid and spend the money at home", description: "Irish taxpayers' money should be spent on Irish needs." },
    ],
  },
  {
    id: 46,
    dimension: 'globalism',
    text: "On foreign policy and tax, EU decisions need every member to agree, so each country has a veto. Should that change?",
    answers: [
      { value: -3.33, text: "Yes; move to majority voting on both so the EU can act faster", description: "One country should not be able to block the whole Union." },
      { value: -1.67, text: "Allow majority voting on foreign policy, but keep the veto on tax", description: "Act together abroad while protecting a vital national interest." },
      { value: 1.67, text: "Keep the veto on both, but use it sparingly", description: "The veto is a safeguard to hold in reserve." },
      { value: 3.33, text: "Keep every veto, and bring more powers back from Brussels to Dublin", description: "Decisions that affect Ireland should be made in Ireland." },
    ],
  },
  {
    id: 14,
    dimension: 'environmental',
    text: "Agricultural emissions are missing targets. Which policy trade-off feels right?",
    answers: [
      { value: -3.33, text: "Mandate herd reduction with compensation for affected farmers", description: "Meet climate goals head-on and pay those who need to transition out of current models." },
      { value: -1.67, text: "Invest heavily in feed additives, precision farming, and innovation grants", description: "Keep herds viable by leaning on technology to decouple production from emissions." },
      { value: 1.67, text: "Allow offsets through forestry, peatland restoration, and biodiversity credits", description: "Let farmers balance emissions elsewhere while production continues largely unchanged." },
      { value: 3.33, text: "Relax timelines so competitiveness and rural livelihoods stay protected", description: "Prioritise agri income now and stretch climate delivery over a longer horizon." },
    ],
  },
  {
    id: 15,
    dimension: 'environmental',
    text: "Ireland’s 2050 energy mix can pursue one anchor strategy. Which one earns your backing?",
    answers: [
      { value: -3.33, text: "Go all-in on offshore wind with new interconnectors exporting surplus", description: "Bet on massive renewables, grid upgrades, and the island as a green power hub." },
      { value: -1.67, text: "Balance renewables with small modular reactors by the 2040s", description: "Keep emissions down using nuclear as a firm power source alongside wind and solar." },
      { value: 1.67, text: "Back green gas and carbon capture to extend existing infrastructure", description: "Blend low-carbon fuels with CCS so current pipelines and industry stay relevant." },
      { value: 3.33, text: "Authorise transitional LNG terminals until new tech fully matures", description: "Secure supply now with gas, then pivot gradually as alternatives scale up." },
    ],
  },
  {
    id: 16,
    dimension: 'environmental',
    text: "Dublin is considering a congestion charge. What’s your move?",
    answers: [
      { value: -3.33, text: "Introduce the charge now and reinvest every euro in cycling, bus lanes, and public realm", description: "Use pricing to change behaviour quickly and fund the alternatives that make it stick." },
      { value: -1.67, text: "Phase it in only after commuter rail expansions are delivered", description: "Wait until the offer improves so charges feel fair and the public has real choices." },
      { value: 1.67, text: "Drop the charge idea, swap in a national EV subsidy and parking reform instead", description: "Steer behaviour through incentives and local policy rather than punitive pricing." },
      { value: 3.33, text: "Reject the charge and stick with road upgrades plus commuter choice", description: "Preserve car freedom, expand road capacity, and leave mobility decisions to citizens." },
    ],
  },
  {
    id: 38,
    dimension: 'environmental',
    text: "Data centres use a large share of Ireland's electricity. How should new ones be connected to the grid?",
    answers: [
      { value: -3.33, text: "Pause new connections until renewable supply and the grid catch up", description: "Climate targets come first; the grid cannot keep absorbing this demand." },
      { value: -1.67, text: "Connect them only if all their demand is matched by new renewable power from day one", description: "New demand should come with new clean supply." },
      { value: 1.67, text: "Connect them if they bring on-site or nearby generation or storage that can support the grid", description: "Let them grow, as long as they help keep the lights on." },
      { value: 3.33, text: "Prioritise them, and expand the grid to meet their demand", description: "They bring investment and jobs, and Ireland should compete for them." },
    ],
  },
  {
    id: 39,
    dimension: 'environmental',
    text: "Ireland's carbon tax is legislated to rise each year to €100 a tonne by 2030. What should happen to it?",
    answers: [
      { value: -3.33, text: "Raise it faster than planned, to cut emissions sooner", description: "A higher price on carbon is the most effective climate tool there is." },
      { value: -1.67, text: "Keep to the legislated path to €100", description: "A steady, predictable rise lets people and businesses plan." },
      { value: 1.67, text: "Pause the increases whenever energy costs are high", description: "Climate policy should not add to pressure on household bills." },
      { value: 3.33, text: "Freeze it, then cut it", description: "It hits rural households and businesses hardest and does little to change behaviour." },
    ],
  },
  {
    id: 40,
    dimension: 'environmental',
    text: "Oil and gas boilers are already ruled out in most new homes. What about existing homes?",
    answers: [
      { value: -3.33, text: "Set a firm date to stop installing new oil and gas boilers in any home, with grants for heat pumps", description: "A clear deadline is the only way to clean up home heating in time." },
      { value: -1.67, text: "Phase them out gradually as old boilers wear out, backed by generous grants", description: "Switch homes over at a pace people can manage." },
      { value: 1.67, text: "Keep them allowed, with grants for people who choose to switch", description: "Encourage change, but let households decide." },
      { value: 3.33, text: "Leave heating entirely to households: no bans and no push to switch", description: "People should heat their homes in whatever way suits them and their budget." },
    ],
  },
  {
    id: 17,
    dimension: 'authority',
    text: "A law would allow Garda facial recognition in limited circumstances. How far should it go?",
    answers: [
      { value: 3.33, text: "Approve broad access with strong oversight and regular effectiveness reviews", description: "Prioritise security and trust accountability frameworks to prevent abuse." },
      { value: 1.67, text: "Pilot in high-threat cases only, with warrants and independent auditing", description: "Test carefully, limit usage, and keep checks in place before any wider rollout." },
      { value: -3.33, text: "Reject the proposal; risks to civil liberties outweigh the promised benefits", description: "Draw a hard line on privacy even if it makes investigations slower." },
      { value: -1.67, text: "Invest instead in community policing and manual investigative capacity", description: "Build trust and human intelligence rather than leaning on controversial tech." },
    ],
  },
  {
    id: 18,
    dimension: 'authority',
    text: "A protest blocks essential infrastructure for hours. What response fits?",
    answers: [
      { value: 3.33, text: "Clear the protest immediately; vital services must trump disruption", description: "Use the powers available to restore normal operations swiftly." },
      { value: 1.67, text: "Facilitate the protest but issue fines or penalties for disruption caused", description: "Protect expression yet signal that blocking infrastructure has consequences." },
      { value: -1.67, text: "Keep dialogue open, intervene only if safety risks escalate", description: "Negotiate first and only escalate once the public is genuinely in danger." },
      { value: -3.33, text: "Protect the protest entirely; disruption is part of democratic pressure", description: "Let demonstrations run their course and avoid any heavy-handed policing." },
    ],
  },
  {
    id: 19,
    dimension: 'authority',
    text: "A new pandemic variant appears. What public health approach do you favour?",
    answers: [
      { value: 3.33, text: "Reinstate mandatory restrictions quickly under a central command structure", description: "Move fast, limit spread, and accept strong state coordination to save lives." },
      { value: 1.67, text: "Stick with voluntary guidance backed by transparent real-time data", description: "Trust citizens once they have the facts and avoid heavy-handed coercion." },
      { value: -1.67, text: "Let local authorities tailor responses based on risk levels in their area", description: "Keep decision-making close to communities instead of a one-size national response." },
      { value: -3.33, text: "Protect high-risk groups only, keep wider society fully open", description: "Shield those most vulnerable while minimising wider economic and social disruption." },
    ],
  },
  {
    id: 35,
    dimension: 'authority',
    text: "Should social media platforms have to verify users' ages and keep under-16s off?",
    answers: [
      { value: 3.33, text: "Yes; ban under-16s outright, with compulsory age checks for every user", description: "Children's safety online justifies firm rules, even if adults must prove their age." },
      { value: 1.67, text: "Require age checks and parental consent for under-16s, without a full ban", description: "Give parents a real say while keeping teenagers online." },
      { value: -1.67, text: "Rely on parents, schools and safer platform design rather than ID checks", description: "Protect children without building an ID system for the whole internet." },
      { value: -3.33, text: "No; age-verification rules threaten everyone's privacy and anonymity online", description: "The state should not make people identify themselves to read or speak online." },
    ],
  },
  {
    id: 36,
    dimension: 'authority',
    text: "Some terrorism and gangland trials in Ireland are heard by judges without a jury. Should that continue?",
    answers: [
      { value: 3.33, text: "Yes; make non-jury courts permanent and use them for more organised-crime cases", description: "Juries can be intimidated; the state must be able to convict dangerous gangs." },
      { value: 1.67, text: "Yes, but only where a judge rules that a jury would be at real risk of intimidation", description: "Keep the option, with a case-by-case safeguard." },
      { value: -1.67, text: "Phase them out as protections for jurors, such as anonymity and remote evidence, improve", description: "Protect jurors rather than do without them." },
      { value: -3.33, text: "No; every serious criminal trial should be heard by a jury", description: "Trial by jury is a basic right that should never be set aside." },
    ],
  },
  {
    id: 37,
    dimension: 'authority',
    text: "Gardaí generally need a reasonable suspicion before they can stop and search someone. Should that change?",
    answers: [
      { value: 3.33, text: "Yes; allow searches without suspicion in designated high-crime areas for set periods", description: "Visible, proactive policing deters knife and drug crime." },
      { value: 1.67, text: "Allow searches without suspicion only at major events and transport hubs, with a senior officer's approval", description: "Target the riskiest places while keeping a safeguard." },
      { value: -1.67, text: "Keep the current powers, with a written reason and body-camera footage for every search", description: "Searches should be accountable as well as lawful." },
      { value: -3.33, text: "Narrow the powers further, so searches happen only for serious offences", description: "Searching people on the street erodes trust and civil liberties." },
    ],
  },
  {
    id: 20,
    dimension: 'welfare',
    text: "Ireland is debating a nationwide universal basic income. What’s your stance?",
    answers: [
      { value: -3.33, text: "Adopt UBI nationwide and replace selected benefits immediately", description: "Guarantee a baseline income and simplify welfare even if taxes rise markedly." },
      { value: -1.67, text: "Run a 5-year pilot in high-poverty regions before any national rollout", description: "Test the concept carefully, evaluate outcomes, and scale only if results justify it." },
      { value: 1.67, text: "Expand targeted programmes instead of creating a universal payment", description: "Keep resources focused on those who need help the most and avoid blanket supports." },
      { value: 3.33, text: "Reject UBI; prioritise job creation, upskilling, and earned income support", description: "Keep incentives to work strong and grow prosperity through enterprise." },
    ],
  },
  {
    id: 21,
    dimension: 'welfare',
    text: "Rent caps are set to expire and evictions are rising. What safety net works?",
    answers: [
      { value: -3.33, text: "Extend caps and create a state landlord of last resort for at-risk tenants", description: "Keep protections strong and let government step in directly where the market fails." },
      { value: -3.33, text: "Boost rent supports and scale rapid-build public housing for supply", description: "Help people stay put now while accelerating public construction for the medium term." },
      { value: 1.67, text: "Incentivise private supply through tax breaks and planning reforms", description: "Make it attractive to build and rent so competition drives affordability." },
      { value: 3.33, text: "Deregulate rent entirely and focus on raising incomes instead", description: "Let the market clear naturally and support people through earnings growth." },
    ],
  },
  {
    id: 22,
    dimension: 'welfare',
    text: "Rural regions lag on services and jobs. How should the state respond?",
    answers: [
      { value: -3.33, text: "Increase central redistribution through larger block grants and national programmes", description: "Use the exchequer to lift regional services and infrastructure directly." },
      { value: -1.67, text: "Tie funding to performance metrics, citizen panels, and accountability dashboards", description: "Keep investments evidence-based and co-designed with residents before money flows." },
      { value: 1.67, text: "Expand enterprise zones, tax incentives, and local investment funds", description: "Stimulate private sector momentum and let local leaders attract employers." },
      { value: 3.33, text: "Encourage relocation with personal tax reliefs and mobility supports", description: "Nudge households to move and rebalance population flows through incentives." },
    ],
  },
  {
    id: 41,
    dimension: 'welfare',
    text: "The State Pension age is 66, and people can choose to defer claiming it up to 70. Should the age change?",
    answers: [
      { value: -3.33, text: "Lower it to 65, so people can retire earlier on a full pension", description: "People who have worked all their lives deserve to retire in good health." },
      { value: -1.67, text: "Keep it at 66 for everyone", description: "People have planned around 66; it should not rise." },
      { value: 1.67, text: "Raise it gradually to 67 as life expectancy rises", description: "Longer lives mean the pension has to be paid for over more years." },
      { value: 3.33, text: "Raise it to 68, and expect people to rely more on private and workplace pensions", description: "The state cannot fund ever-longer retirements; people should save for their own." },
    ],
  },
  {
    id: 42,
    dimension: 'welfare',
    text: "The state subsidises childcare for every child in registered care, with extra help for lower-income families. How should support work?",
    answers: [
      { value: -3.33, text: "Make childcare free for every child, like primary school", description: "Childcare is a public service every family should be able to rely on." },
      { value: -1.67, text: "Cap fees low for every family, with extra help for lower incomes", description: "Make it affordable for all and cheapest for those who need it most." },
      { value: 1.67, text: "Focus state support on lower-income families; others pay more of the cost", description: "Spend public money where it makes the biggest difference." },
      { value: 3.33, text: "Leave the cost mainly to parents, with tax relief instead of subsidies", description: "Families should choose and pay for the care that suits them, keeping more of their own income." },
    ],
  },
  {
    id: 43,
    dimension: 'welfare',
    text: "People who lose their job can get a jobseeker's payment linked to their previous pay for a limited time. How generous should it be?",
    answers: [
      { value: -3.33, text: "More generous and longer-lasting, so losing a job never means a sudden drop in income", description: "A strong safety net lets people find the right next job." },
      { value: -1.67, text: "Keep it as it is", description: "It cushions a job loss without discouraging work." },
      { value: 1.67, text: "Shorten it, to encourage a faster return to work", description: "Support should be a bridge back to work, not a long stay." },
      { value: 3.33, text: "Go back to one flat rate for everyone, with stricter job-search conditions", description: "Welfare should be a basic floor, not a match for past earnings." },
    ],
  },
  {
    id: 23,
    dimension: 'technocratic',
    text: "Cabinet considers AI-driven policy simulations to stress-test decisions. Your call?",
    answers: [
      { value: -3.33, text: "Adopt the tools and let expert teams steer policy with data-rich simulations", description: "Lean into technocratic delivery with analytics guiding ministers on the key moves." },
      { value: -1.67, text: "Pilot the technology first and require citizens’ assemblies to validate major findings", description: "Blend expert input with participatory democracy before policies go live." },
      { value: 1.67, text: "Use simulations as advisory only; elected representatives must own final calls", description: "Keep technology in a supporting role so politics remains accountable and human-led." },
      { value: 3.33, text: "Reject the approach; opaque algorithms shouldn’t steer national decisions", description: "Prioritise transparency and democratic instinct over experimental governance tech." },
    ],
  },
  {
    id: 24,
    dimension: 'technocratic',
    text: "Should citizens’ assemblies gain any binding authority over specific reforms?",
    answers: [
      { value: 3.33, text: "Yes—give assemblies binding power on social and climate legislation", description: "Let deliberative democracy lead the way on values-driven policy areas." },
      { value: 1.67, text: "Yes, but require Dáil ratification before anything takes effect", description: "Marry citizen deliberation with parliamentary legitimacy to keep balance." },
      { value: -1.67, text: "Keep assemblies advisory; elected TDs should always make the final decision", description: "Value their input but protect representative democracy as the ultimate authority." },
      { value: -3.33, text: "Limit the assemblies; too many processes dilute electoral mandates", description: "Return focus to the ballot box and keep reforms in the hands of elected leadership." },
    ],
  },
  {
    id: 25,
    dimension: 'technocratic',
    text: "A productivity audit finds sluggish delivery across public services. What reform leads?",
    answers: [
      { value: -1.67, text: "Introduce performance contracts, bonuses, and consequences for missed targets", description: "Bring private-sector style accountability into departments and agencies." },
      { value: -1.67, text: "Invest in serious digital transformation and user-centric service redesign", description: "Fund the tools and teams that make government intuitive and data-driven." },
      { value: 0, text: "Merge overlapping agencies and cut middle layers to streamline decision-making", description: "Reduce duplication, shrink bureaucracy, and keep structures nimble." },
      { value: 1.67, text: "Give front-line departments more discretion and loosen central controls", description: "Trust practitioners to innovate locally without restrictive HQ oversight." },
    ],
  },
  {
    id: 47,
    dimension: 'technocratic',
    text: "Irish government ministers must be members of the Dáil or Seanad. Should the Taoiseach be able to appoint outside experts as ministers?",
    answers: [
      { value: -3.33, text: "Yes; let the Taoiseach appoint proven experts from outside politics", description: "Government should be run by the most capable people, elected or not." },
      { value: -1.67, text: "Allow a few outside experts, each approved by a Dáil vote", description: "Bring in expertise while keeping the Dáil in control." },
      { value: 1.67, text: "No; ministers should keep coming from the Oireachtas", description: "Those who govern should answer to voters." },
      { value: 3.33, text: "No, and go further: only elected TDs should be ministers", description: "Every minister should hold a seat won directly from the people." },
    ],
  },
  {
    id: 48,
    dimension: 'technocratic',
    text: "In Ireland, only members of the Oireachtas can start the process for a referendum. Should citizens be able to trigger one?",
    answers: [
      { value: 3.33, text: "Yes; any proposal backed by enough citizens' signatures should go to a referendum", description: "The people should be able to set the agenda, not just vote on it." },
      { value: 1.67, text: "Let a large enough petition force a Dáil debate and vote, but not a referendum", description: "Give citizens a way in, while leaving the decision with the Dáil." },
      { value: -1.67, text: "No; keep referendums in the hands of the Oireachtas", description: "Constitutional change needs careful drafting by people accountable for it." },
      { value: -3.33, text: "No, and put fewer questions to the people, leaving more to legislation and expert advice", description: "Complex questions are better settled by elected representatives and experts than by a yes/no vote." },
    ],
  },
  {
    id: 49,
    dimension: 'technocratic',
    text: "The Central Bank sets limits on mortgage lending, such as how much people can borrow relative to their income. Who should decide these rules?",
    answers: [
      { value: -3.33, text: "The Central Bank alone; politicians should not interfere", description: "Independent experts protect the country from another property crash." },
      { value: -1.67, text: "The Central Bank, but it should explain each change to the Oireachtas", description: "Keep the rules independent while making them accountable." },
      { value: 1.67, text: "The Oireachtas should set broad limits, with the Central Bank handling the details", description: "Rules this important to families should have a democratic say." },
      { value: 3.33, text: "The Dáil, with power to override the Central Bank", description: "Elected representatives, not officials, should answer for who can buy a home." },
    ],
  },
];
