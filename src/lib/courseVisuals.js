import {
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Car,
  ChefHat,
  Coffee,
  GraduationCap,
  HandHeart,
  Hotel,
  Laptop,
  Leaf,
  Palette,
  PartyPopper,
  Scissors,
  Sparkles,
  Stethoscope,
  Utensils,
  Wrench,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Course icons: give every training program a distinctive Lucide icon instead
// of an emoji. Works for the seed programs AND for courses an admin adds later
// (which only have a title/category to go on).
// ---------------------------------------------------------------------------

// Known seed programs get a hand-picked icon.
const ICON_BY_ID = {
  housekeeping: Sparkles,
  barista: Coffee,
  hilot: HandHeart,
  'event-management': PartyPopper,
  'virtual-assistant': Laptop,
  bookkeeping: Briefcase,
}

// Fallback: match the category/title against common TVET program keywords.
const ICON_BY_KEYWORD = [
  [/housekeep|clean|janitor|accommodation/i, Sparkles],
  [/barista|coffee|cafe|beverage|bartend/i, Coffee],
  [/hilot|massage|wellness|spa|therap|health|caregiv|nurs/i, HandHeart],
  [/event|celebrat|party|festival/i, PartyPopper],
  [/virtual|assistant|computer|information tech|software|programming|i\.?t\.?\b/i, Laptop],
  [/culinary|food|bakery|bread|pastry|kitchen|cook|chef/i, ChefHat],
  [/hotel|tourism|hospitality|travel|tour|front office/i, Hotel],
  [/restaurant|food service|waiter|dining/i, Utensils],
  [/medical|clinic|dental|pharmac|lab/i, Stethoscope],
  [/agricultur|farm|horticultur|garden|organic|aquacultur/i, Leaf],
  [/beauty|hair|nail|cosmetolog|salon|dressmak|tailor|fashion|garment|sew/i, Scissors],
  [/automotive|motor|driving|auto|vehicle|car|mechanic/i, Car],
  [/photograph|media|videograph|multimedia|animation/i, Camera],
  [/welding|electrical|electronics|construction|masonry|plumbing|fabrication|refrigeration|air ?con/i, Wrench],
  [/design|graphic|arts|creative/i, Palette],
  [/business|account|bookkeep|manage|entrepreneur|office|admin/i, Briefcase],
  [/building|drafting|civil|architect/i, Building2],
  [/education|teaching|trainer|assessor|child/i, GraduationCap],
]

export function courseIcon(program) {
  if (!program) return BookOpen
  if (ICON_BY_ID[program.id]) return ICON_BY_ID[program.id]
  const haystack = `${program.category || ''} ${program.title || ''}`
  for (const [pattern, Icon] of ICON_BY_KEYWORD) {
    if (pattern.test(haystack)) return Icon
  }
  return BookOpen
}
