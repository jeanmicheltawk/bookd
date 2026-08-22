const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const config = require('../src/config');

const CATEGORIES = [
  { slug: 'models', name: 'Models', searchable: true, order: 1 },
  { slug: 'talents', name: 'Talents', searchable: true, order: 2 },
  { slug: 'photographers', name: 'Photographers', searchable: true, order: 3 },
  { slug: 'videographers', name: 'Videographers', searchable: true, order: 4 },
  { slug: 'directors', name: 'Directors', searchable: true, order: 5 },
  { slug: 'creative-directors', name: 'Creative Directors', searchable: true, order: 6 },
  { slug: 'art-directors', name: 'Art Directors', searchable: true, order: 7 },
  { slug: 'makeup-artists', name: 'Makeup Artists', searchable: true, order: 8 },
  { slug: 'hair-stylists', name: 'Hair Stylists', searchable: true, order: 9 },
  { slug: 'makeup-hair', name: 'Makeup & Hair', searchable: true, order: 10 },
  { slug: 'stylists', name: 'Stylists', searchable: true, order: 11 },
  { slug: 'content-creators', name: 'Content Creators', searchable: true, order: 12 },
  { slug: 'brand-client', name: 'Brand / Client', searchable: false, order: 99 },
];

const COUNTRIES = [
  { slug: 'lebanon', name: 'Lebanon', order: 1 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const c of CATEGORIES) {
      await client.query(
        `INSERT INTO categories (slug, name, is_searchable, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_searchable = EXCLUDED.is_searchable, sort_order = EXCLUDED.sort_order`,
        [c.slug, c.name, c.searchable, c.order]
      );
    }

    for (const c of COUNTRIES) {
      await client.query(
        `INSERT INTO countries (slug, name, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [c.slug, c.name, c.order]
      );
    }

    const hash = await bcrypt.hash(config.admin.password, 12);
    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, role, membership, is_verified, is_active, approval_status, reviewed_at)
       VALUES ($1, $2, 'admin', 'premium', TRUE, TRUE, 'approved', NOW())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         approval_status = 'approved',
         reviewed_at = COALESCE(users.reviewed_at, NOW())
       RETURNING id`,
      [config.admin.email, hash]
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `INSERT INTO profiles (user_id, full_name, professional_name, bio, is_public, country)
       VALUES ($1, 'BOOK''D Admin', 'BK''D Admin', 'Platform administrator', FALSE, 'Global')
       ON CONFLICT (user_id) DO NOTHING`,
      [adminId]
    );

    await client.query(
      `INSERT INTO theme_settings (
         name, is_active, primary_color, secondary_color, accent_color,
         background_color, text_color, button_color, button_text_color,
         gradient_from, gradient_to, verified_badge_color
       )
       SELECT 'BOOK''D Acid', TRUE, '#C6FF00', '#FF00A8', '#00F5FF',
              '#FF4D00', '#FFFFFF', '#C6FF00', '#09000F',
              '#C6FF00', '#C6FF00', '#00F5FF'
       WHERE NOT EXISTS (SELECT 1 FROM theme_settings WHERE is_active = TRUE)`
    );

    const settings = [
      ['site', {
        name: "BOOK'D",
        logoText: "BK'D",
        slogan: 'BOOK AND GET BOOK\'D',
        tagline: 'Discover. Connect. Collaborate. Book.',
        description: "BOOK'D is an international creative networking and booking platform for fashion, beauty, advertising and content creation.",
      }],
      ['navigation', {
        links: [
          { label: 'Discover', url: '/discover' },
          { label: 'Announcements', url: '/announcements' },
          { label: 'Challenges', url: '/challenges' },
          { label: 'Learn', url: '/learn' },
          { label: 'Pricing', url: '/pricing' },
          { label: 'Contact', url: '/contact' },
        ],
      }],
      ['contact', {
        email: 'info@bookdhaus.com',
        supportEmail: 'info@bookdhaus.com',
      }],
      ['social', {
        instagram: 'https://www.instagram.com/bookdhaus?igsi=MWh3ZWl2ZTZ3engzcg==',
      }],
      ['footer', {
        copyright: "© 2026 BOOK'D HAUS. All rights reserved.",
        columns: [
          { title: 'Platform', links: [{ label: 'Discover', url: '/discover' }, { label: 'Announcements', url: '/announcements' }, { label: 'Challenges', url: '/challenges' }] },
          { title: 'Creatives', links: [{ label: 'Apply', url: '/auth/signup' }, { label: 'Pricing', url: '/pricing' }, { label: 'Learn', url: '/learn' }] },
          { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Contact', url: '/contact' }, { label: 'Terms', url: '/terms' }] },
        ],
      }],
    ];

    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO website_settings (key, value) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }

    const pageRes = await client.query(
      `INSERT INTO pages (slug, title, meta_title, meta_description, is_published)
       VALUES ('home', 'Home', 'BOOK''D — Book and Get Book''d', 'Creative networking and booking platform for fashion, beauty and content creation.', TRUE)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
       RETURNING id`
    );
    const homeId = pageRes.rows[0].id;

    const sections = [
      {
        key: 'hero',
        title: "BOOK AND GET BOOK'D",
        subtitle: 'The bold network for creatives who make culture.',
        content: {
          slides: [
            { type: 'industry_news', title: 'INDUSTRY NEWS', body: 'Stay ahead of fashion, beauty & campaign culture.' },
            { type: 'fashion_trends', title: 'FASHION TRENDS', body: 'What the next season is already booking.' },
            { type: 'featured_campaigns', title: 'FEATURED CAMPAIGNS', body: 'See who got booked this week.' },
            { type: 'featured_creatives', title: 'FEATURED CREATIVES', body: 'Talent shaping the next visual era.' },
            { type: 'platform_updates', title: 'PLATFORM UPDATES', body: 'New ways to get discovered & booked.' },
            { type: 'success_stories', title: 'SUCCESS STORIES', body: 'From portfolio to paid booking.' },
          ],
          ctaPrimary: { label: 'Apply to BOOK\'D', url: '/auth/signup' },
          ctaSecondary: { label: 'Explore Talent', url: '/discover' },
        },
        cta_label: "Apply to BOOK'D",
        cta_url: '/auth/signup',
        sort: 1,
      },
      {
        key: 'about',
        title: 'BUILT FOR CREATIVES',
        subtitle: 'Discover, connect, collaborate, and book one another.',
        content: {
          body: "From designers and photographers to models, filmmakers, editors, stylists, and artists — BOOK'D brings creative talent together in one bold community.",
          values: ['BOLD', 'EXPRESSIVE', 'FEARLESS', 'CREATIVE', 'INCLUSIVE', 'ENERGETIC'],
        },
        sort: 2,
      },
      {
        key: 'services',
        title: 'EVERYTHING YOU NEED TO GET BOOK\'D',
        subtitle: 'Portfolios, bookings, announcements, learning & more.',
        content: {
          items: [
            { title: 'Build Portfolio', desc: 'Show your work. Get discovered.' },
            { title: 'Get Booked', desc: 'BOOK NOW flow with project workspace.' },
            { title: 'Announcements', desc: 'Casting calls, jobs & collabs.' },
            { title: 'Verification', desc: 'Trust badges that boost ranking.' },
            { title: 'Analytics', desc: 'Views, ranking & growth insights.' },
            { title: 'Learning Hub', desc: 'Guides, tips & creative inspiration.' },
          ],
        },
        sort: 3,
      },
      {
        key: 'membership',
        title: 'MEMBERSHIP',
        subtitle: 'From free to premium — pick your spotlight.',
        content: {
          plans: [
            { id: 'free', name: 'Free', price: 0, trial: null, blurb: 'Create a profile. Save favourites. Browse announcements.' },
            { id: 'basic', name: 'Basic', price: 19, trial: '7-day free trial', blurb: 'Messaging, calendar, reviews & better visibility.' },
            { id: 'premium', name: 'Premium', price: 49, trial: '2-week free trial', blurb: 'Priority search, unlimited portfolio & business tools.' },
          ],
        },
        sort: 4,
      },
    ];

    for (const s of sections) {
      await client.query(
        `INSERT INTO sections (page_id, key, title, subtitle, content, cta_label, cta_url, sort_order, is_visible)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, TRUE)
         ON CONFLICT (page_id, key) DO UPDATE SET
           title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           content = EXCLUDED.content,
           cta_label = EXCLUDED.cta_label,
           cta_url = EXCLUDED.cta_url,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()`,
        [homeId, s.key, s.title, s.subtitle, JSON.stringify(s.content), s.cta_label || null, s.cta_url || null, s.sort]
      );
    }

    const demoUsers = [
      { email: 'maya@bookd.demo', name: 'Maya Chen', pro: 'Maya C.', cat: 'photographers', country: 'Lebanon', membership: 'premium', verified: true },
      { email: 'leo@bookd.demo', name: 'Leo Santos', pro: 'LEO', cat: 'models', country: 'Lebanon', membership: 'premium', verified: true },
      { email: 'aria@bookd.demo', name: 'Aria Novak', pro: 'Aria N.', cat: 'makeup-artists', country: 'Lebanon', membership: 'basic', verified: true },
      { email: 'jon@bookd.demo', name: 'Jon Park', pro: 'JON PARK', cat: 'videographers', country: 'Lebanon', membership: 'basic', verified: false },
      { email: 'sofia@bookd.demo', name: 'Sofia Reyes', pro: 'Sofia R.', cat: 'stylists', country: 'Lebanon', membership: 'premium', verified: true },
      { email: 'brand@bookd.demo', name: 'Neon Label', pro: 'Neon Label', cat: 'brand-client', country: 'Lebanon', membership: 'premium', verified: true, role: 'brand' },
    ];

    const demoPass = await bcrypt.hash('demo1234', 10);
    for (const u of demoUsers) {
      const cat = await client.query('SELECT id FROM categories WHERE slug = $1', [u.cat]);
      const ur = await client.query(
        `INSERT INTO users (email, password_hash, role, membership, is_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (email) DO UPDATE SET membership = EXCLUDED.membership
         RETURNING id`,
        [u.email, demoPass, u.role || 'member', u.membership, u.verified]
      );
      const isTalent = (u.role || 'member') !== 'brand';
      await client.query(
        `INSERT INTO profiles (user_id, category_id, full_name, professional_name, country, bio, is_public, years_experience, availability)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available')
         ON CONFLICT (user_id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           full_name = EXCLUDED.full_name,
           professional_name = EXCLUDED.professional_name,
           country = EXCLUDED.country,
           is_public = EXCLUDED.is_public`,
        [
          ur.rows[0].id,
          cat.rows[0]?.id || null,
          u.name,
          u.pro,
          u.country,
          isTalent
            ? `${u.pro} — creative on BOOK'D. Ready to collaborate.`
            : `${u.pro} — client on BOOK'D.`,
          isTalent,
          isTalent ? 3 + Math.floor(Math.random() * 10) : null,
        ]
      );
    }

    await client.query(
      `INSERT INTO testimonials (author_name, author_role, content, rating, is_published, sort_order)
       SELECT * FROM (VALUES
         ('Maya Chen', 'Photographer', 'BOOK''D got me three campaign bookings in a month. The energy is unmatched.', 5, TRUE, 1),
         ('Leo Santos', 'Model', 'Finally a platform that feels like the industry — bold, fast, and fair.', 5, TRUE, 2),
         ('Neon Label', 'Brand', 'Finding verified creatives has never been this smooth.', 5, TRUE, 3)
       ) AS v(author_name, author_role, content, rating, is_published, sort_order)
       WHERE NOT EXISTS (SELECT 1 FROM testimonials LIMIT 1)`
    );

    await client.query(
      `INSERT INTO events (title, slug, description, event_type, prize, is_published, starts_at, ends_at)
       SELECT 'Best Editorial Challenge', 'best-editorial', 'Submit your strongest editorial frame.', 'challenge',
              'Premium Membership + Featured Homepage', TRUE, NOW(), NOW() + INTERVAL '30 days'
       WHERE NOT EXISTS (SELECT 1 FROM events WHERE slug = 'best-editorial')`
    );

    await client.query(
      `INSERT INTO learning_articles (title, slug, category, content, is_published)
       SELECT * FROM (VALUES
         ('How to Price Your Next Shoot', 'how-to-price-your-next-shoot', 'Pricing Advice', 'A practical guide to quoting projects fairly based on complexity, usage and location.', TRUE),
         ('Portfolio Building Essentials', 'portfolio-building-essentials', 'Portfolio Building', 'Curate a portfolio that books — sequence, story, and standout frames.', TRUE),
         ('Client Communication That Converts', 'client-communication', 'Client Communication', 'Turn inquiries into bookings with clear briefs and fast responses.', TRUE)
       ) AS v(title, slug, category, content, is_published)
       WHERE NOT EXISTS (SELECT 1 FROM learning_articles LIMIT 1)`
    );

    const brand = await client.query(`SELECT id FROM users WHERE email = 'brand@bookd.demo'`);
    const photoCat = await client.query(`SELECT id FROM categories WHERE slug = 'photographers'`);
    if (brand.rows[0]) {
      await client.query(
        `INSERT INTO announcements (author_id, title, announcement_type, description, budget, is_paid, location, deadline, required_category_id, people_needed, status)
         SELECT $1, 'Fashion Lookbook Photographer Needed', 'Photographer Needed',
                'Looking for a bold editorial photographer for a 2-day lookbook in LA.',
                2500, TRUE, 'Los Angeles, USA', NOW() + INTERVAL '14 days', $2, 1, 'approved'
         WHERE NOT EXISTS (SELECT 1 FROM announcements LIMIT 1)`,
        [brand.rows[0].id, photoCat.rows[0]?.id]
      );
      await client.query(
        `INSERT INTO announcements (author_id, title, announcement_type, description, budget, is_paid, location, deadline, people_needed, status)
         SELECT $1, 'Street Style Model Call', 'Model Call',
                'Casting diverse models for a street-style campaign. Paid day rate.',
                800, TRUE, 'New York, USA', NOW() + INTERVAL '10 days', 4, 'approved'
         WHERE (SELECT COUNT(*) FROM announcements) < 2`,
        [brand.rows[0].id]
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log(`Admin: ${config.admin.email} / ${config.admin.password}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
