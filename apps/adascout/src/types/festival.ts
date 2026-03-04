export type FestivalLocationCategory =
  | "parade"
  | "music"
  | "jubilee"
  | "parking"
  | "info"
  | "food";

export interface FestivalLocation {
  id: string;
  title: string;
  slug: string;
  category: FestivalLocationCategory;
  lat: number;
  lng: number;
  address: string;
  description: string;
  startAt?: string;
  endAt?: string;
  tags: string[];
  businessName: string;
  businessEmail: string;
  businessContactInfo: string;
  ctaLabel?: string;
  ctaHref?: string;
}
