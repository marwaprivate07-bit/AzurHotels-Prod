/**
 * KpiIcons — Vibrant colorful icons using Lucide React
 * Each icon has a gradient-ready color for maximum visual impact
 */
import {
  DollarSign, TrendingUp, TrendingDown, Percent, Calendar, CalendarDays,
  BarChart3, BedDouble, Users, LayoutGrid, Building2, Coins, Layers,
  User, UserMinus, Star, Heart, Wallet, Archive, Tag, Award, PieChart,
  Zap, ShoppingCart, Building, CreditCard, ClipboardList, Landmark,
  Lightbulb, Flame, Droplets, Fuel, Sun, CloudSun, Snowflake,
  CheckCircle2, AlertCircle, Scale, Receipt, ArrowUpRight, ArrowDownRight,
  Target, Sparkles, Crown, Gem, Rocket, Leaf
} from "lucide-react";

const wrap = (Icon, color, size = 20) => () => (
  <Icon
    size={size}
    color="#fff"
    strokeWidth={2.2}
    style={{
      filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.35))`,
      display: "block",
    }}
  />
);

// ─── CA Icons ────────────────────────────────────────
export const IconRevenue     = wrap(Landmark, "#16A34A");
export const IconMonitor     = wrap(Building2, "#4F46E5");
export const IconTrendUp     = wrap(TrendingUp, "#059669");
export const IconPercent     = wrap(Percent, "#7C3AED");
export const IconCalendar    = wrap(Calendar, "#4F46E5");
export const IconCalendarOld = wrap(CalendarDays, "#64748B");
export const IconBarChart    = wrap(BarChart3, "#4F46E5");

// ─── Stats Icons ────────────────────────────────────
export const IconBed         = wrap(BedDouble, "#8B5CF6");
export const IconUsers       = wrap(Users, "#7C3AED");
export const IconOccupancy   = wrap(Target, "#10B981");
export const IconBuilding    = wrap(Building2, "#1E3A8A");
export const IconCoins       = wrap(Coins, "#F59E0B");
export const IconLayers      = wrap(Layers, "#8B5CF6");
export const IconUser        = wrap(User, "#4F46E5");
export const IconUserMinus   = wrap(UserMinus, "#1E3A8A");
export const IconStar        = wrap(Star, "#F59E0B");
export const IconHeart       = wrap(Heart, "#EC4899");

// ─── Charges Icons ──────────────────────────────────
export const IconWallet      = wrap(Wallet, "#4F46E5");
export const IconArchive     = wrap(Archive, "#4F46E5");
export const IconTag         = wrap(Tag, "#F59E0B");

// ─── Resultat Icons ─────────────────────────────────
export const IconAward       = wrap(Award, "#F59E0B");
export const IconPieChart    = wrap(PieChart, "#4F46E5");

// ─── Common / Shared ────────────────────────────────
export const IconUsersGroup    = wrap(Users, "#4F46E5");
export const IconZap           = wrap(Zap, "#F59E0B");
export const IconShoppingCart  = wrap(ShoppingCart, "#059669");
export const IconBuilding2     = wrap(Building, "#8B5CF6");
export const IconCreditCard    = wrap(CreditCard, "#EC4899");
export const IconClipboard     = wrap(ClipboardList, "#64748B");
export const IconCrane         = wrap(Landmark, "#78716C");
export const IconLightBulb     = wrap(Lightbulb, "#F59E0B");
export const IconFlame         = wrap(Flame, "#EF4444");
export const IconDroplet       = wrap(Droplets, "#7C3AED");
export const IconFuel          = wrap(Fuel, "#A855F7");

// ─── Season Icons ───────────────────────────────────
export const IconSun          = wrap(Sun, "#F59E0B");
export const IconCloudSun     = wrap(CloudSun, "#7C3AED");
export const IconSnowflake    = wrap(Snowflake, "#38BDF8");

// ─── Status Icons ───────────────────────────────────
export const IconCheckCircle   = wrap(CheckCircle2, "#059669");
export const IconAlertCircle   = wrap(AlertCircle, "#EF4444");
export const IconScale         = wrap(Scale, "#4F46E5");
export const IconReceipt       = wrap(Receipt, "#1E3A8A");
export const IconTrendDown     = wrap(TrendingDown, "#EF4444");
export const IconArrowUpRight  = wrap(ArrowUpRight, "#059669");
export const IconArrowDownRight = wrap(ArrowDownRight, "#EF4444");

// ─── Premium Icons ───────────────────────────────────
export const IconCrown        = wrap(Crown, "#F59E0B");
export const IconGem          = wrap(Gem, "#8B5CF6");
export const IconRocket       = wrap(Rocket, "#EF4444");
export const IconSparkles     = wrap(Sparkles, "#F59E0B");
export const IconLeaf         = wrap(Leaf, "#10B981");
export const IconTarget       = wrap(Target, "#10B981");
