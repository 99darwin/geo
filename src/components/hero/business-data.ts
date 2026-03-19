type Competitor = { name: string; rating: string; reviews: string; desc: string };

export interface BusinessEntry {
  name: string;
  competitors: [Competitor, Competitor, Competitor];
}

export const BUSINESSES: BusinessEntry[] = [
  {
    name: "Joe's Coffee",
    competitors: [
      { name: 'Morning Grind Café', rating: '4.8', reviews: '312', desc: 'Specialty coffee and fresh pastries in a cozy neighborhood setting.' },
      { name: 'Bean & Brew Coffee Co.', rating: '4.7', reviews: '287', desc: 'Locally roasted beans with a rotating seasonal menu and drive-through.' },
      { name: 'Copper Kettle Roasters', rating: '4.6', reviews: '198', desc: 'Third-wave coffee shop known for single-origin pour-overs and latte art.' },
    ],
  },
  {
    name: 'Bright Smile Dental',
    competitors: [
      { name: 'Peak Performance Dental', rating: '4.8', reviews: '312', desc: 'Full-service dental care with modern technology and a patient-first approach.' },
      { name: 'Lakeside Family Dentistry', rating: '4.7', reviews: '287', desc: 'Comprehensive family dentistry offering cleanings, implants, and cosmetic work.' },
      { name: 'Downtown Dental Group', rating: '4.6', reviews: '198', desc: 'Affordable dental services in the heart of downtown with evening hours.' },
    ],
  },
  {
    name: 'Summit Auto Repair',
    competitors: [
      { name: 'Precision Auto Works', rating: '4.8', reviews: '276', desc: 'ASE-certified mechanics specializing in domestic and import vehicles.' },
      { name: 'Crossroads Auto Care', rating: '4.7', reviews: '241', desc: 'Honest pricing and same-day service for brakes, tires, and engine work.' },
      { name: 'Valley Garage & Tire', rating: '4.5', reviews: '189', desc: 'Trusted family-run shop with 20+ years of experience and free estimates.' },
    ],
  },
  {
    name: 'Green Leaf Landscaping',
    competitors: [
      { name: 'Evergreen Lawn & Garden', rating: '4.8', reviews: '254', desc: 'Full-service landscaping from design to seasonal maintenance programs.' },
      { name: 'Stonework Landscapes', rating: '4.7', reviews: '213', desc: 'Custom hardscaping and garden design for residential properties.' },
      { name: 'Fresh Cut Outdoor Services', rating: '4.5', reviews: '178', desc: 'Reliable weekly lawn care and spring/fall cleanup packages.' },
    ],
  },
  {
    name: 'Harbor View Restaurant',
    competitors: [
      { name: 'The Waterfront Grill', rating: '4.8', reviews: '389', desc: 'Upscale seafood dining with panoramic views and craft cocktails.' },
      { name: 'Pier 41 Kitchen', rating: '4.7', reviews: '302', desc: 'Farm-to-table American cuisine in a relaxed harborside atmosphere.' },
      { name: 'Coastal Tavern', rating: '4.6', reviews: '256', desc: 'Casual dining with local catch specials, brunch, and live music weekends.' },
    ],
  },
  {
    name: 'Elite Fitness Studio',
    competitors: [
      { name: 'Iron & Flow Fitness', rating: '4.8', reviews: '298', desc: 'Boutique gym offering HIIT, yoga, and personal training programs.' },
      { name: 'CoreFit Athletics', rating: '4.7', reviews: '245', desc: 'Group fitness classes and strength training with certified coaches.' },
      { name: 'Pulse Performance Lab', rating: '4.5', reviews: '192', desc: 'Sports-focused training facility with recovery and nutrition services.' },
    ],
  },
];

export const GENERIC_COMPETITORS: [Competitor, Competitor, Competitor] = [
  { name: 'Top Local Competitor', rating: '4.8', reviews: '312', desc: 'Well-established local business with strong reviews and loyal customers.' },
  { name: 'Area Runner-Up', rating: '4.7', reviews: '287', desc: 'Growing presence in the area with competitive pricing and good service.' },
  { name: 'Regional Alternative', rating: '4.5', reviews: '198', desc: 'Newer entrant gaining traction through marketing and AI visibility.' },
];

export const BUSINESS_NAMES = BUSINESSES.map((b) => b.name);

export const LONGEST_NAME = BUSINESS_NAMES.reduce((a, b) => (a.length > b.length ? a : b), '');
