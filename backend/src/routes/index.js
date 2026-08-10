const express = require('express');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const auth = require('../controllers/authController');
const category = require('../controllers/categoryController');
const country = require('../controllers/countryController');
const search = require('../controllers/searchController');
const cms = require('../controllers/cmsController');
const media = require('../controllers/mediaController');
const contact = require('../controllers/contactController');
const analytics = require('../controllers/analyticsController');
const profile = require('../controllers/profileController');
const announcement = require('../controllers/announcementController');
const booking = require('../controllers/bookingController');
const message = require('../controllers/messageController');
const event = require('../controllers/eventController');
const learning = require('../controllers/learningController');
const testimonial = require('../controllers/testimonialController');
const dashboard = require('../controllers/dashboardController');
const pricing = require('../controllers/pricingController');
const adminUsers = require('../controllers/adminUserController');

const router = express.Router();
const admin = [authenticate, requireRole('admin')];

// Auth
router.post('/auth/register', auth.registerValidators, auth.register);
router.post('/auth/login', auth.loginValidators, auth.login);
router.post('/auth/refresh', auth.refresh);
router.get('/auth/me', authenticate, auth.me);

// Categories
router.get('/categories', category.listCategories);
router.post('/admin/categories', ...admin, category.createCategory);
router.patch('/admin/categories/:id', ...admin, category.updateCategory);
router.delete('/admin/categories/:id', ...admin, category.deleteCategory);
router.post('/admin/categories/:id/fields', ...admin, category.createCategoryField);
router.patch('/admin/categories/:id/fields/:fieldId', ...admin, category.updateCategoryField);
router.delete('/admin/categories/:id/fields/:fieldId', ...admin, category.deleteCategoryField);

// Countries
router.get('/countries', country.listCountries);
router.post('/admin/countries', ...admin, country.createCountry);
router.patch('/admin/countries/:id', ...admin, country.updateCountry);
router.delete('/admin/countries/:id', ...admin, country.deleteCountry);

// Search & discovery
router.get('/search', optionalAuth, search.searchProfiles);
router.get('/spotlight', search.getSpotlight);
router.get('/hero-slides', search.getHeroSlides);

// CMS
router.get('/cms/settings', cms.getAllSettings);
router.get('/cms/settings/:key', cms.getSettingByKey);
router.put('/cms/settings/:key', ...admin, cms.updateSettingByKey);
router.get('/cms/theme', cms.getTheme);
router.put('/cms/theme', ...admin, cms.updateTheme);
router.get('/cms/pages/:slug', optionalAuth, cms.getPageBySlug);
router.put('/cms/pages/:slug', ...admin, cms.updatePageBySlug);
router.get('/cms/pages/:slug/sections', optionalAuth, cms.getPageSections);
router.put('/cms/sections/:id', ...admin, cms.updateSection);

// Media
router.get('/media', ...admin, media.listMedia);
router.get('/media/folders', ...admin, media.listFolders);
router.get('/media/:id', ...admin, media.getMediaById);
router.post('/media', ...admin, upload.single('file'), media.uploadMedia);
router.put('/media/:id', ...admin, upload.single('file'), media.replaceMedia);
router.delete('/media/:id', ...admin, media.deleteMedia);

// Contact
router.post('/contact', contact.createContact);
router.get('/contact', ...admin, contact.listContacts);
router.patch('/contact/:id', ...admin, contact.updateContactStatus);
router.delete('/contact/:id', ...admin, contact.deleteContact);
router.get('/contact/export/csv', ...admin, contact.exportContactsCsv);

// Analytics
router.post('/analytics/track', optionalAuth, analytics.trackPageview);
router.get('/admin/analytics', ...admin, analytics.getAdminDashboard);

// Profiles
router.get('/profiles/me', authenticate, profile.getMyProfile);
router.get('/profiles/me/portfolio', authenticate, profile.listPortfolio);
router.post('/profiles/me/portfolio', authenticate, profile.addPortfolioItem);
router.patch('/profiles/me/portfolio/:id', authenticate, profile.updatePortfolioItem);
router.delete('/profiles/me/portfolio/:id', authenticate, profile.deletePortfolioItem);
router.patch('/profiles/me', authenticate, profile.updateMyProfile);
router.get('/profiles/:idOrSlug', optionalAuth, profile.getPublicProfile);

// Announcements
router.get('/announcements', announcement.listApproved);
router.get('/announcements/mine', authenticate, announcement.listMyAnnouncements);
router.get('/announcements/:id', optionalAuth, announcement.getAnnouncement);
router.post('/announcements', authenticate, announcement.createAnnouncement);
router.post('/announcements/:id/apply', authenticate, announcement.applyToAnnouncement);
router.get('/announcements/:id/applications', authenticate, announcement.listApplications);
router.get('/admin/announcements', ...admin, announcement.listAllAdmin);
router.patch('/admin/announcements/:id', ...admin, announcement.moderateAnnouncement);

// Bookings
router.post('/bookings', authenticate, booking.createBooking);
router.get('/bookings/mine', authenticate, booking.listMine);
router.get('/bookings/:id', authenticate, booking.getBooking);
router.post('/bookings/:id/accept', authenticate, booking.acceptBooking);
router.post('/bookings/:id/decline', authenticate, booking.declineBooking);
router.post('/bookings/:id/negotiate', authenticate, booking.negotiateBooking);
router.patch('/bookings/:id/status', authenticate, booking.updateBookingStatus);

// Messages
router.get('/messages/conversations', authenticate, message.listConversations);
router.post('/messages/conversations', authenticate, message.getOrCreateConversation);
router.get('/messages/conversations/:id', authenticate, message.listMessages);
router.post('/messages/conversations/:id', authenticate, message.sendMessage);
router.post('/messages/conversations/:id/read', authenticate, message.markRead);
router.get('/messages/saved', authenticate, message.listSavedMessages);
router.patch('/messages/:messageId/save', authenticate, message.saveMessage);
router.post('/messages/:messageId/report', authenticate, message.reportMessage);

// Events
router.get('/events', event.listEvents);
router.get('/events/:idOrSlug', optionalAuth, event.getEvent);
router.get('/admin/events', ...admin, event.listAllEventsAdmin);
router.post('/admin/events', ...admin, event.createEvent);
router.patch('/admin/events/:id', ...admin, event.updateEvent);
router.delete('/admin/events/:id', ...admin, event.deleteEvent);

// Learning
router.get('/learn', learning.listArticles);
router.get('/learn/:idOrSlug', optionalAuth, learning.getArticle);
router.get('/admin/learn', ...admin, learning.listAllArticlesAdmin);
router.post('/admin/learn', ...admin, learning.createArticle);
router.patch('/admin/learn/:id', ...admin, learning.updateArticle);
router.delete('/admin/learn/:id', ...admin, learning.deleteArticle);

// Testimonials
router.get('/testimonials', testimonial.listPublished);
router.get('/admin/testimonials', ...admin, testimonial.listAllAdmin);
router.post('/admin/testimonials', ...admin, testimonial.createTestimonial);
router.patch('/admin/testimonials/:id', ...admin, testimonial.updateTestimonial);
router.delete('/admin/testimonials/:id', ...admin, testimonial.deleteTestimonial);

// Pricing
router.post('/pricing/estimate', pricing.estimatePrice);

// Dashboard
router.get('/dashboard/me', authenticate, dashboard.getMyDashboard);

// Admin users
router.get('/admin/users', ...admin, adminUsers.listUsers);
router.get('/admin/users/:id', ...admin, adminUsers.getUser);
router.patch('/admin/users/:id', ...admin, adminUsers.updateUser);

module.exports = router;
