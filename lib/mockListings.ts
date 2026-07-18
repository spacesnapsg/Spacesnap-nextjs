export type ListingType = "space" | "equipment" | "consumable";

export interface RentalListing {
  id: number;
  name: string;
  type: "space" | "equipment";
  location: string;
  is_available: boolean;
  price_day: number;
  price_week: number;
  price_month: number;
}

export interface ConsumableListing {
  id: number;
  name: string;
  type: "consumable";
  location: string;
  is_available: boolean;
  price_per_unit: number;
  unit_label: string;
}

export type Listing = RentalListing | ConsumableListing;

export const MOCK_LISTINGS: Listing[] = [
  {
    id: 1,
    name: "Wet Lab Bench - Downtown SF",
    type: "space",
    location: "San Francisco, CA",
    is_available: true,
    price_day: 45,
    price_week: 280,
    price_month: 950,
  },
  {
    id: 2,
    name: "High-Speed Centrifuge",
    type: "equipment",
    location: "Austin, TX",
    is_available: true,
    price_day: 25,
    price_week: 150,
    price_month: 520,
  },
  {
    id: 3,
    name: "Nitrile Gloves (Case of 100)",
    type: "consumable",
    location: "Boston, MA",
    is_available: true,
    price_per_unit: 8,
    unit_label: "case",
  },
  {
    id: 4,
    name: "BSL-2 Research Suite",
    type: "space",
    location: "Cambridge, MA",
    is_available: false,
    price_day: 65,
    price_week: 400,
    price_month: 1400,
  },
  {
    id: 5,
    name: "PCR Thermocycler",
    type: "equipment",
    location: "Seattle, WA",
    is_available: true,
    price_day: 30,
    price_week: 180,
    price_month: 620,
  },
  {
    id: 6,
    name: "Sterile Petri Dishes (Pack of 100)",
    type: "consumable",
    location: "San Diego, CA",
    is_available: false,
    price_per_unit: 5,
    unit_label: "pack",
  },
  {
    id: 7,
    name: "Biosafety Cabinet - Class II",
    type: "equipment",
    location: "Denver, CO",
    is_available: false,
    price_day: 55,
    price_week: 340,
    price_month: 1150,
  },
  {
    id: 8,
    name: "Autoclave Sterilization Pouches",
    type: "consumable",
    location: "Chicago, IL",
    is_available: true,
    price_per_unit: 12,
    unit_label: "box of 200",
  },
];
