// Word bank: add categories or words freely.
// WORDS_AR must list the same categories, with each word at the same position.
const WORDS = {
  "At the Ball": [
    "Chandelier", "Waltz", "Perfume", "Ballgown", "Violin", "Staircase", "Tuxedo",
    "Fan", "Candelabra", "Orchestra", "Corset", "Invitation", "Tiara", "Gloves", "Mirror",
  ],
  "Food & Drink": [
    "Pizza", "Sushi", "Pancake", "Taco", "Croissant", "Lasagna", "Popcorn", "Smoothie",
    "Burrito", "Cheesecake", "Ramen", "Waffle", "Lemonade", "Falafel", "Shawarma",
  ],
  "Animals": [
    "Penguin", "Giraffe", "Octopus", "Kangaroo", "Peacock", "Hedgehog", "Dolphin",
    "Chameleon", "Flamingo", "Panda", "Bat", "Crocodile", "Owl", "Sloth", "Jellyfish",
  ],
  "Places": [
    "Library", "Airport", "Hospital", "Stadium", "Lighthouse", "Castle", "Submarine",
    "Desert", "Museum", "Cinema", "Volcano", "Prison", "Circus", "Cemetery", "Bakery",
  ],
  "Professions": [
    "Detective", "Chef", "Pilot", "Magician", "Dentist", "Astronaut", "Firefighter",
    "Librarian", "Pirate", "Butler", "Surgeon", "Spy", "Lawyer", "Gardener", "Knight",
  ],
  "Objects": [
    "Umbrella", "Telescope", "Candle", "Compass", "Hourglass", "Key", "Lantern",
    "Typewriter", "Crown", "Scissors", "Pillow", "Locket", "Anchor", "Quill", "Dice",
  ],
  "Mysteries": [
    "Ghost", "Vampire", "Poison", "Secret Passage", "Alibi", "Fingerprint", "Diary",
    "Curse", "Will", "Masked Stranger", "Locked Room", "Blackmail", "Disguise", "Heist", "Ransom",
  ],
  "Sports & Games": [
    "Chess", "Fencing", "Bowling", "Surfing", "Archery", "Volleyball", "Tennis", "Hockey",
    "Boxing", "Golf", "Skateboard", "Darts", "Wrestling", "Marathon", "Billiards",
  ],
};

const CATEGORY_AR = {
  "At the Ball": "في الحفل",
  "Food & Drink": "طعام وشراب",
  "Animals": "حيوانات",
  "Places": "أماكن",
  "Professions": "مهن",
  "Objects": "أشياء",
  "Mysteries": "ألغاز",
  "Sports & Games": "رياضة وألعاب",
};

const WORDS_AR = {
  "At the Ball": [
    "ثريا", "فالس", "عطر", "فستان سهرة", "كمان", "درج", "بدلة رسمية",
    "مروحة يد", "شمعدان", "أوركسترا", "مشد", "دعوة", "إكليل", "قفازات", "مرآة",
  ],
  "Food & Drink": [
    "بيتزا", "سوشي", "بان كيك", "تاكو", "كرواسون", "لازانيا", "فشار", "سموذي",
    "بوريتو", "تشيز كيك", "رامن", "وافل", "ليموناضة", "فلافل", "شاورما",
  ],
  "Animals": [
    "بطريق", "زرافة", "أخطبوط", "كنغر", "طاووس", "قنفذ", "دلفين",
    "حرباء", "فلامنغو", "باندا", "خفاش", "تمساح", "بومة", "كسلان", "قنديل البحر",
  ],
  "Places": [
    "مكتبة", "مطار", "مستشفى", "ملعب", "منارة", "قلعة", "غواصة",
    "صحراء", "متحف", "سينما", "بركان", "سجن", "سيرك", "مقبرة", "مخبز",
  ],
  "Professions": [
    "محقق", "طباخ", "طيار", "ساحر", "طبيب أسنان", "رائد فضاء", "إطفائي",
    "أمين مكتبة", "قرصان", "خادم", "جراح", "جاسوس", "محامي", "بستاني", "فارس",
  ],
  "Objects": [
    "مظلة", "تلسكوب", "شمعة", "بوصلة", "ساعة رملية", "مفتاح", "فانوس",
    "آلة كاتبة", "تاج", "مقص", "وسادة", "قلادة", "مرساة", "ريشة كتابة", "نرد",
  ],
  "Mysteries": [
    "شبح", "مصاص دماء", "سم", "ممر سري", "حجة غياب", "بصمة", "مذكرات",
    "لعنة", "وصية", "غريب مقنع", "غرفة مقفلة", "ابتزاز", "تنكر", "سطو", "فدية",
  ],
  "Sports & Games": [
    "شطرنج", "مبارزة", "بولينغ", "ركوب الأمواج", "رماية", "كرة الطائرة", "تنس", "هوكي",
    "ملاكمة", "غولف", "لوح تزلج", "رمي السهام", "مصارعة", "ماراثون", "بلياردو",
  ],
};
