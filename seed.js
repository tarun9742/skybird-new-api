const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Platform = require("./models/Platform");
const Course = require("./models/Course");
const Admin = require("./models/Admin");

dotenv.config();

const platforms = [
  {
    id: "amazon",
    name: "Amazon",
    tagline: "Scale your Amazon seller account with listings, ads, and ops.",
  },
  {
    id: "meesho",
    name: "Meesho",
    tagline: "Grow as a Meesho supplier with catalog, pricing, and fulfilment.",
  },
  {
    id: "flipkart",
    name: "Flipkart",
    tagline: "Win Flipkart search, ads, and account health from day one.",
  },
];

const courses = [
  {
    id: "amz-fba-mastery",
    platform: "amazon",
    title: "Amazon FBA Mastery",
    price: 1999,
    duration: "4h 20m",
    lessons: 18,
    level: "Beginner",
    thumbnail:
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&q=80",
    description:
      "Learn how to source products, create high-converting listings, and run a profitable Amazon FBA operation.",
    videoUrl: "https://sample-videos.com/amazon/fba-intro.mp4",
    videos: [
      {
        id: "amz-fba-1",
        title: "Introduction to Amazon FBA & Account Setup",
        duration: "18m",
        link: "https://sample-videos.com/amazon/fba-intro.mp4",
      },
      {
        id: "amz-fba-2",
        title: "Product Research & Sourcing Strategies",
        duration: "32m",
        link: "https://sample-videos.com/amazon/fba-sourcing.mp4",
      },
      {
        id: "amz-fba-3",
        title: "Creating High-Converting Listings",
        duration: "27m",
        link: "https://sample-videos.com/amazon/fba-listings.mp4",
      },
      {
        id: "amz-fba-4",
        title: "Inventory Management & Scaling",
        duration: "24m",
        link: "https://sample-videos.com/amazon/fba-scaling.mp4",
      },
    ],
  },
  {
    id: "amz-ads",
    platform: "amazon",
    title: "Amazon Ads That Convert",
    price: 1499,
    duration: "3h 10m",
    lessons: 12,
    level: "Intermediate",
    thumbnail:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    description:
      "Build Sponsored Products campaigns, manage ACOS, and scale ads without wasting budget.",
    videoUrl: "https://sample-videos.com/amazon/ads-setup.mp4",
    videos: [
      {
        id: "amz-ads-1",
        title: "Sponsored Products Campaign Setup",
        duration: "22m",
        link: "https://sample-videos.com/amazon/ads-setup.mp4",
      },
      {
        id: "amz-ads-2",
        title: "Keyword Targeting & Bid Strategies",
        duration: "28m",
        link: "https://sample-videos.com/amazon/ads-keywords.mp4",
      },
      {
        id: "amz-ads-3",
        title: "Managing ACOS & Optimizing Performance",
        duration: "25m",
        link: "https://sample-videos.com/amazon/ads-acos.mp4",
      },
      {
        id: "amz-ads-4",
        title: "Scaling Winning Campaigns",
        duration: "19m",
        link: "https://sample-videos.com/amazon/ads-scale.mp4",
      },
    ],
  },
  {
    id: "amz-seo",
    platform: "amazon",
    title: "Amazon Listing SEO",
    price: 999,
    duration: "2h 05m",
    lessons: 9,
    level: "Beginner",
    thumbnail:
      "https://images.unsplash.com/photo-1586880244406-556ebe35f282?w=800&q=80",
    description:
      "Keyword research, backend search terms, and listing copy that ranks in Amazon search.",
    videoUrl: "https://sample-videos.com/amazon/seo-keywords.mp4",
    videos: [
      {
        id: "amz-seo-1",
        title: "Amazon Keyword Research Tools & Methods",
        duration: "20m",
        link: "https://sample-videos.com/amazon/seo-keywords.mp4",
      },
      {
        id: "amz-seo-2",
        title: "Backend Search Terms & Indexing",
        duration: "16m",
        link: "https://sample-videos.com/amazon/seo-backend.mp4",
      },
      {
        id: "amz-seo-3",
        title: "Writing Ranking Listing Copy",
        duration: "18m",
        link: "https://sample-videos.com/amazon/seo-copy.mp4",
      },
    ],
  },
  {
    id: "mee-supplier",
    platform: "meesho",
    title: "Meesho Supplier Growth",
    price: 1299,
    duration: "3h 40m",
    lessons: 14,
    level: "Beginner",
    thumbnail:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
    description:
      "Onboard as a supplier, pick winning categories, and grow repeat orders on Meesho.",
    videoUrl: "https://sample-videos.com/meesho/supplier-onboard.mp4",
    videos: [
      {
        id: "mee-sup-1",
        title: "Meesho Supplier Onboarding Process",
        duration: "15m",
        link: "https://sample-videos.com/meesho/supplier-onboard.mp4",
      },
      {
        id: "mee-sup-2",
        title: "Choosing High-Demand Categories",
        duration: "23m",
        link: "https://sample-videos.com/meesho/supplier-categories.mp4",
      },
      {
        id: "mee-sup-3",
        title: "Building Repeat Orders & Customer Retention",
        duration: "21m",
        link: "https://sample-videos.com/meesho/supplier-repeat.mp4",
      },
      {
        id: "mee-sup-4",
        title: "Growth Hacks for New Suppliers",
        duration: "18m",
        link: "https://sample-videos.com/meesho/supplier-growth.mp4",
      },
    ],
  },
  {
    id: "mee-catalog",
    platform: "meesho",
    title: "Meesho Catalog & Pricing",
    price: 899,
    duration: "1h 50m",
    lessons: 8,
    level: "Beginner",
    thumbnail:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    description:
      "Create catalogs that convert, set competitive prices, and avoid common quality flags.",
    videoUrl: "https://sample-videos.com/meesho/catalog-create.mp4",
    videos: [
      {
        id: "mee-cat-1",
        title: "Creating Converting Catalogs",
        duration: "17m",
        link: "https://sample-videos.com/meesho/catalog-create.mp4",
      },
      {
        id: "mee-cat-2",
        title: "Competitive Pricing Strategies",
        duration: "14m",
        link: "https://sample-videos.com/meesho/catalog-pricing.mp4",
      },
      {
        id: "mee-cat-3",
        title: "Avoiding Quality Flags & Rejections",
        duration: "16m",
        link: "https://sample-videos.com/meesho/catalog-quality.mp4",
      },
    ],
  },
  {
    id: "flp-launch",
    platform: "flipkart",
    title: "Flipkart Seller Launch",
    price: 1499,
    duration: "3h 25m",
    lessons: 13,
    level: "Beginner",
    thumbnail:
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
    description:
      "Register, list products, and complete your first 30 days as a Flipkart seller.",
    videoUrl: "https://sample-videos.com/flipkart/launch-register.mp4",
    videos: [
      {
        id: "flp-lan-1",
        title: "Flipkart Seller Registration & KYC",
        duration: "19m",
        link: "https://sample-videos.com/flipkart/launch-register.mp4",
      },
      {
        id: "flp-lan-2",
        title: "Listing Your First Products",
        duration: "26m",
        link: "https://sample-videos.com/flipkart/launch-listing.mp4",
      },
      {
        id: "flp-lan-3",
        title: "First 30 Days Checklist & Best Practices",
        duration: "22m",
        link: "https://sample-videos.com/flipkart/launch-30days.mp4",
      },
      {
        id: "flp-lan-4",
        title: "Handling Orders & Returns",
        duration: "15m",
        link: "https://sample-videos.com/flipkart/launch-orders.mp4",
      },
    ],
  },
  {
    id: "flp-ads",
    platform: "flipkart",
    title: "Flipkart Ads & Ranking",
    price: 1199,
    duration: "2h 30m",
    lessons: 10,
    level: "Intermediate",
    thumbnail:
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=800&q=80",
    description:
      "Use PLA campaigns, improve listing quality score, and climb Flipkart search results.",
    videoUrl: "https://sample-videos.com/flipkart/ads-pla.mp4",
    videos: [
      {
        id: "flp-ads-1",
        title: "PLA Campaign Setup on Flipkart",
        duration: "20m",
        link: "https://sample-videos.com/flipkart/ads-pla.mp4",
      },
      {
        id: "flp-ads-2",
        title: "Improving Listing Quality Score",
        duration: "18m",
        link: "https://sample-videos.com/flipkart/ads-quality.mp4",
      },
      {
        id: "flp-ads-3",
        title: "Ranking Higher in Flipkart Search",
        duration: "21m",
        link: "https://sample-videos.com/flipkart/ads-ranking.mp4",
      },
    ],
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected for seeding...");

    if (process.env.SEED_ALLOW_DESTRUCTIVE !== "true") throw new Error("Seeding can delete existing data. Set SEED_ALLOW_DESTRUCTIVE=true only for a disposable database.");
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || process.env.ADMIN_PASSWORD === "admin123") throw new Error("Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters before seeding.");
    await Platform.deleteMany({});
    await Course.deleteMany({});
    await Admin.deleteMany({});
    console.log("Existing seed data cleared (explicit destructive mode enabled)");

    // Seed platforms
    await Platform.insertMany(platforms);
    console.log(`✅ ${platforms.length} platforms seeded`);

    // Seed courses
    await Course.insertMany(courses);
    console.log(`✅ ${courses.length} courses seeded`);

    // Create default admin
    const admin = await Admin.create({
      email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
      password: process.env.ADMIN_PASSWORD,
      name: "Super Admin",
    });
    console.log(`✅ Admin created → ${admin.email} (password not logged)`);

    console.log("\n🎉 Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDB();
