import 'dotenv/config';
import { db, migrate } from './db.js';

migrate();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const admin =
  email && db.prepare("SELECT id FROM users WHERE email = ? AND role = 'admin'").get(email);
if (!admin) {
  console.error(
    'Create an admin account with seed:admin and set ADMIN_EMAIL before seeding demo listings.',
  );
  process.exitCode = 1;
} else {
  const examples = [
    [
      'الأيام',
      'طه حسين',
      'كتاب من أشهر أعمال السيرة الذاتية في الأدب العربي.',
      'book',
      'good',
      1982,
      180,
    ],
    [
      'ألف ليلة وليلة',
      'تراث عربي',
      'نسخة مزخرفة من حكايات التراث العربي.',
      'rare',
      'excellent',
      1976,
      420,
    ],
    [
      'مجلة الهلال — عدد قديم',
      'دار الهلال',
      'عدد قديم لمحبي الدوريات الثقافية.',
      'magazine',
      'good',
      1968,
      95,
    ],
    [
      'مخطوطة في الخط العربي',
      'غير معروف',
      'نسخة مصورة لعشاق الخط والمخطوطات.',
      'manuscript',
      'fair',
      1920,
      650,
    ],
    [
      'جريدة الأهرام — إصدار أرشيفي',
      'الأهرام',
      'نسخة أرشيفية من صحيفة مصرية عريقة.',
      'newspaper',
      'good',
      1973,
      130,
    ],
    [
      'موسم الهجرة إلى الشمال',
      'الطيب صالح',
      'رواية عربية ذات حضور مميز.',
      'book',
      'excellent',
      1998,
      210,
    ],
    ['حي بن يقظان', 'ابن طفيل', 'طبعة قديمة من النص الفلسفي الشهير.', 'rare', 'good', 1955, 290],
    ['رجال في الشمس', 'غسان كنفاني', 'عمل روائي قصير ومؤثر.', 'book', 'new', 2018, 165],
  ];
  const insert =
    db.prepare(`INSERT INTO listings (seller_id, title, author, description, item_type, item_condition, publication_year, price, quantity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3, 'approved')`);
  for (const row of examples)
    if (
      !db.prepare('SELECT 1 FROM listings WHERE seller_id = ? AND title = ?').get(admin.id, row[0])
    )
      insert.run(admin.id, ...row);
  console.log('Demo listings ready.');
}
db.close();
