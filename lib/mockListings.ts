export type ListingType = "space" | "equipment" | "consumable";

interface ListingBase {
  id: number;
  company_id: number;
  name: string;
  location: string;
  description: string;
  amenities: string[];
  required_certificate_ids: number[];
  is_available: boolean;
  require_approval: boolean;
}

export interface RentalListing extends ListingBase {
  type: "space" | "equipment";
  price_day: number;
  price_week: number;
  price_month: number;
}

export interface ConsumableListing extends ListingBase {
  type: "consumable";
  price_per_unit: number;
  unit_label: string;
  pack_size: string;
  stock_quantity: number;
}

export type Listing = RentalListing | ConsumableListing;

export const MOCK_CURRENT_SUPPLIER_ID = 1;

export const MOCK_LISTINGS: Listing[] = [
  {
    id: 1,
    company_id: 1,
    name: "Wet Lab Bench - Downtown SF",
    type: "space",
    location: "San Francisco, CA",
    description: "A fully equipped wet lab bench in the heart of downtown SF.",
    amenities: ["Fume Hood", "24/7 Access", "Emergency Shower"],
    required_certificate_ids: [1, 4],
    is_available: true,
    require_approval: false,
    price_day: 45,
    price_week: 280,
    price_month: 950,
  },
  {
    id: 2,
    company_id: 2,
    name: "High-Speed Centrifuge",
    type: "equipment",
    location: "Austin, TX",
    description: "High-speed centrifuge suitable for a wide range of sample types.",
    amenities: ["Calibrated Monthly", "Digital Display"],
    required_certificate_ids: [2],
    is_available: true,
    require_approval: false,
    price_day: 25,
    price_week: 150,
    price_month: 520,
  },
  {
    id: 3,
    company_id: 1,
    name: "Nitrile Gloves (Case of 100)",
    type: "consumable",
    location: "Boston, MA",
    description: "Latex-free nitrile gloves, sold by the case.",
    amenities: ["Latex-Free", "Bulk Pack"],
    required_certificate_ids: [],
    is_available: true,
    require_approval: false,
    price_per_unit: 8,
    unit_label: "case",
    pack_size: "Case of 100",
    stock_quantity: 500,
  },
  {
    id: 4,
    company_id: 3,
    name: "BSL-2 Research Suite",
    type: "space",
    location: "Cambridge, MA",
    description: "A fully contained BSL-2 suite for advanced research.",
    amenities: ["Biosafety Cabinet", "Autoclave", "24/7 Access"],
    required_certificate_ids: [1, 4],
    is_available: false,
    require_approval: true,
    price_day: 65,
    price_week: 400,
    price_month: 1400,
  },
  {
    id: 5,
    company_id: 1,
    name: "PCR Thermocycler",
    type: "equipment",
    location: "Seattle, WA",
    description: "Reliable thermocycler with gradient function for PCR workflows.",
    amenities: ["96-Well Format", "Gradient Function"],
    required_certificate_ids: [2, 3],
    is_available: true,
    require_approval: false,
    price_day: 30,
    price_week: 180,
    price_month: 620,
  },
  {
    id: 6,
    company_id: 2,
    name: "Sterile Petri Dishes (Pack of 100)",
    type: "consumable",
    location: "San Diego, CA",
    description: "Sterile petri dishes, packed 100 to a case.",
    amenities: ["Sterile", "Pack of 100"],
    required_certificate_ids: [],
    is_available: true,
    require_approval: false,
    price_per_unit: 5,
    unit_label: "pack",
    pack_size: "Pack of 100",
    stock_quantity: 0,
  },
  {
    id: 7,
    company_id: 3,
    name: "Biosafety Cabinet - Class II",
    type: "equipment",
    location: "Denver, CO",
    description: "Class II biosafety cabinet for contained sample handling.",
    amenities: ["HEPA Filtered", "UV Sterilization"],
    required_certificate_ids: [2, 4],
    is_available: false,
    require_approval: true,
    price_day: 55,
    price_week: 340,
    price_month: 1150,
  },
  {
    id: 8,
    company_id: 1,
    name: "Autoclave Sterilization Pouches",
    type: "consumable",
    location: "Chicago, IL",
    description: "Self-sealing sterilization pouches for autoclave use.",
    amenities: ["Self-Sealing", "Steam Indicator"],
    required_certificate_ids: [],
    is_available: true,
    require_approval: false,
    price_per_unit: 12,
    unit_label: "box of 200",
    pack_size: "Box of 200",
    stock_quantity: 300,
  },
];
