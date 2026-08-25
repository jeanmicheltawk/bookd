const express = require('express');
const { authenticate, optionalAuth, requireRole, requireApproved } = require('../middleware/auth');
const { upload, imageUpload, forceUploadFolder } = require('../middleware/upload');

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
const cancellations = require('../controllers/subscriptionCancellationController');
const payments = require('../controllers/paymentController');

const router = express.Router();
const admin = [authenticate, requireRole('admin')];
const approved = [authenticate, requireApproved];

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
router.post(
  '/profiles/me/photo',
  authenticate,
  forceUploadFolder('avatars'),
  imageUpload.single('file'),
  profile.uploadProfilePhoto
);
router.get('/profiles/me/portfolio', ...approved, profile.listPortfolio);
router.post(
  '/profiles/me/portfolio/upload',
  ...approved,
  forceUploadFolder('portfolio'),
  upload.single('file'),
  profile.uploadPortfolioMedia
);
router.post('/profiles/me/portfolio', ...approved, profile.addPortfolioItem);
router.patch('/profiles/me/portfolio/:id', ...approved, profile.updatePortfolioItem);
router.delete('/profiles/me/portfolio/:id', ...approved, profile.deletePortfolioItem);
router.patch('/profiles/me', authenticate, profile.updateMyProfile);
router.get('/profiles/:idOrSlug', optionalAuth, profile.getPublicProfile);

// Announcements
router.get('/announcements', announcement.listApproved);
router.get('/announcements/mine', ...approved, announcement.listMyAnnouncements);
router.get('/announcements/:id', optionalAuth, announcement.getAnnouncement);
router.post('/announcements', ...approved, announcement.createAnnouncement);
router.post('/announcements/:id/apply', ...approved, announcement.applyToAnnouncement);
router.get('/announcements/:id/applications', ...approved, announcement.listApplications);
router.get('/admin/announcements', ...admin, announcement.listAllAdmin);
router.patch('/admin/announcements/:id', ...admin, announcement.moderateAnnouncement);

// Bookings
router.post('/bookings', ...approved, booking.createBooking);
router.get('/bookings/mine', ...approved, booking.listMine);
router.get('/admin/bookings', ...admin, booking.listAllAdmin);
router.get('/bookings/:id', ...approved, booking.getBooking);
router.post('/bookings/:id/accept', ...approved, booking.acceptBooking);
router.post('/bookings/:id/decline', ...approved, booking.declineBooking);
router.post('/bookings/:id/negotiate', ...approved, booking.negotiateBooking);
router.patch('/bookings/:id/status', ...approved, booking.updateBookingStatus);

// Messages
router.get('/messages/conversations', ...approved, message.listConversations);
router.post('/messages/conversations', ...approved, message.getOrCreateConversation);
router.get('/messages/conversations/:id', ...approved, message.listMessages);
router.post('/messages/conversations/:id', ...approved, message.sendMessage);
router.post('/messages/conversations/:id/read', ...approved, message.markRead);
router.get('/messages/saved', ...approved, message.listSavedMessages);
router.patch('/messages/:messageId/save', ...approved, message.saveMessage);
router.post('/messages/:messageId/report', ...approved, message.reportMessage);

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
router.get('/dashboard/alerts', authenticate, dashboard.getAlerts);
router.post('/dashboard/notifications/read', ...approved, dashboard.markNotificationsRead);
router.post('/dashboard/subscription/end', ...approved, dashboard.endMySubscription);
router.get('/payments/whish', authenticate, payments.getMyWhishPayment);
router.post('/payments/whish', authenticate, payments.submitMyWhishPayment);

// Admin users
router.get('/admin/clients/export', ...admin, adminUsers.exportClientsExcel);
router.get('/admin/users', ...admin, adminUsers.listUsers);
router.get('/admin/users/:id', ...admin, adminUsers.getUser);
router.patch('/admin/users/:id', ...admin, adminUsers.updateUser);
router.post('/admin/users/:id/subscription/remind', ...admin, adminUsers.remindUserSubscription);
router.post('/admin/users/:id/subscription/end', ...admin, adminUsers.endUserSubscription);
router.get('/admin/subscription-cancellations', ...admin, cancellations.listCancellations);
router.patch('/admin/subscription-cancellations/:id', ...admin, cancellations.updateCancellationRefund);
router.get('/admin/payments', ...admin, payments.listPayments);
router.post('/admin/payments/:id/confirm', ...admin, payments.confirmPayment);
router.post('/admin/payments/:id/reject', ...admin, payments.rejectPayment);
router.delete('/admin/users/:id', ...admin, adminUsers.deleteUser);

module.exports = router;
