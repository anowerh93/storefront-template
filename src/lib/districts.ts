/**
 * The 64 districts (জেলা) of Bangladesh — Bangla value + English label.
 *
 * Used as a <datalist> behind the checkout জেলা field: mobile-first
 * type-ahead (native keyboard suggestions, no JS dropdown to fight on small
 * screens) where typing either "কুম…" or "Cum…" surfaces কুমিল্লা, but ANY
 * free text is still accepted — the field never blocks an order.
 */
export type District = { bn: string; en: string };

export const BD_DISTRICTS: District[] = [
  // Dhaka division
  { bn: 'ঢাকা', en: 'Dhaka' },
  { bn: 'ফরিদপুর', en: 'Faridpur' },
  { bn: 'গাজীপুর', en: 'Gazipur' },
  { bn: 'গোপালগঞ্জ', en: 'Gopalganj' },
  { bn: 'কিশোরগঞ্জ', en: 'Kishoreganj' },
  { bn: 'মাদারীপুর', en: 'Madaripur' },
  { bn: 'মানিকগঞ্জ', en: 'Manikganj' },
  { bn: 'মুন্সীগঞ্জ', en: 'Munshiganj' },
  { bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' },
  { bn: 'নরসিংদী', en: 'Narsingdi' },
  { bn: 'রাজবাড়ী', en: 'Rajbari' },
  { bn: 'শরীয়তপুর', en: 'Shariatpur' },
  { bn: 'টাঙ্গাইল', en: 'Tangail' },
  // Chattogram division
  { bn: 'ব্রাহ্মণবাড়িয়া', en: 'Brahmanbaria' },
  { bn: 'বান্দরবান', en: 'Bandarban' },
  { bn: 'চাঁদপুর', en: 'Chandpur' },
  { bn: 'চট্টগ্রাম', en: 'Chattogram' },
  { bn: 'কুমিল্লা', en: 'Cumilla' },
  { bn: 'কক্সবাজার', en: "Cox's Bazar" },
  { bn: 'ফেনী', en: 'Feni' },
  { bn: 'খাগড়াছড়ি', en: 'Khagrachhari' },
  { bn: 'লক্ষ্মীপুর', en: 'Lakshmipur' },
  { bn: 'নোয়াখালী', en: 'Noakhali' },
  { bn: 'রাঙ্গামাটি', en: 'Rangamati' },
  // Rajshahi division
  { bn: 'বগুড়া', en: 'Bogura' },
  { bn: 'চাঁপাইনবাবগঞ্জ', en: 'Chapainawabganj' },
  { bn: 'জয়পুরহাট', en: 'Joypurhat' },
  { bn: 'নওগাঁ', en: 'Naogaon' },
  { bn: 'নাটোর', en: 'Natore' },
  { bn: 'পাবনা', en: 'Pabna' },
  { bn: 'রাজশাহী', en: 'Rajshahi' },
  { bn: 'সিরাজগঞ্জ', en: 'Sirajganj' },
  // Khulna division
  { bn: 'বাগেরহাট', en: 'Bagerhat' },
  { bn: 'চুয়াডাঙ্গা', en: 'Chuadanga' },
  { bn: 'যশোর', en: 'Jashore' },
  { bn: 'ঝিনাইদহ', en: 'Jhenaidah' },
  { bn: 'খুলনা', en: 'Khulna' },
  { bn: 'কুষ্টিয়া', en: 'Kushtia' },
  { bn: 'মাগুরা', en: 'Magura' },
  { bn: 'মেহেরপুর', en: 'Meherpur' },
  { bn: 'নড়াইল', en: 'Narail' },
  { bn: 'সাতক্ষীরা', en: 'Satkhira' },
  // Barishal division
  { bn: 'বরগুনা', en: 'Barguna' },
  { bn: 'বরিশাল', en: 'Barishal' },
  { bn: 'ভোলা', en: 'Bhola' },
  { bn: 'ঝালকাঠি', en: 'Jhalokathi' },
  { bn: 'পটুয়াখালী', en: 'Patuakhali' },
  { bn: 'পিরোজপুর', en: 'Pirojpur' },
  // Sylhet division
  { bn: 'হবিগঞ্জ', en: 'Habiganj' },
  { bn: 'মৌলভীবাজার', en: 'Moulvibazar' },
  { bn: 'সুনামগঞ্জ', en: 'Sunamganj' },
  { bn: 'সিলেট', en: 'Sylhet' },
  // Rangpur division
  { bn: 'দিনাজপুর', en: 'Dinajpur' },
  { bn: 'গাইবান্ধা', en: 'Gaibandha' },
  { bn: 'কুড়িগ্রাম', en: 'Kurigram' },
  { bn: 'লালমনিরহাট', en: 'Lalmonirhat' },
  { bn: 'নীলফামারী', en: 'Nilphamari' },
  { bn: 'পঞ্চগড়', en: 'Panchagarh' },
  { bn: 'রংপুর', en: 'Rangpur' },
  { bn: 'ঠাকুরগাঁও', en: 'Thakurgaon' },
  // Mymensingh division
  { bn: 'জামালপুর', en: 'Jamalpur' },
  { bn: 'ময়মনসিংহ', en: 'Mymensingh' },
  { bn: 'নেত্রকোণা', en: 'Netrokona' },
  { bn: 'শেরপুর', en: 'Sherpur' },
];
