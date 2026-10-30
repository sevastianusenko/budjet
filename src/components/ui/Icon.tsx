import {
  Baby, Banknote, Bike, Book, Briefcase, Bus, Car, Cat, Church, Clapperboard, Coffee, Coins, CreditCard, Dog,
  Droplets, Dumbbell, Flame, Fuel, Gamepad2, Gift, Globe, GraduationCap, Hammer, Heart, HeartPulse, House,
  Laptop, Music, Palmtree, PartyPopper, PawPrint, Phone, PiggyBank, Pill, Pizza, Plane, Scissors,
  ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Sofa, Sparkles, SprayCan, Stethoscope, Store, Tag, Target,
  Trees, TrendingUp, Tv, UtensilsCrossed, Wifi, Wine, Wrench, Zap,
  type LucideIcon, type LucideProps,
} from "lucide-react";

/** Curated icon set so the client bundle only ships what categories and goals can use. */
export const ICONS: Record<string, LucideIcon> = {
  Baby, Banknote, Bike, Book, Briefcase, Bus, Car, Cat, Church, Clapperboard, Coffee, Coins, CreditCard, Dog,
  Droplets, Dumbbell, Flame, Fuel, Gamepad2, Gift, Globe, GraduationCap, Hammer, Heart, HeartPulse, House,
  Laptop, Music, Palmtree, PartyPopper, PawPrint, Phone, PiggyBank, Pill, Pizza, Plane, Scissors,
  ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Sofa, Sparkles, SprayCan, Stethoscope, Store, Tag, Target,
  Trees, TrendingUp, Tv, UtensilsCrossed, Wifi, Wine, Wrench, Zap,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? Tag;
  return <Cmp aria-hidden {...props} />;
}
