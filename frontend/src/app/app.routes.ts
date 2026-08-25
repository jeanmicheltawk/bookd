import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { talentGuard } from './core/guards/talent.guard';
import { approvedGuard } from './core/guards/approved.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        // Home is Discover for now (marketing home kept for later)
        path: '',
        loadComponent: () => import('./pages/discover/discover.component').then((m) => m.DiscoverComponent),
        title: "BOOK'D HAUS — Discover Creatives",
      },
      {
        path: 'discover',
        redirectTo: '',
        pathMatch: 'full',
      },
      // FUTURE: marketing home page
      // {
      //   path: 'home',
      //   loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      //   title: "BOOK'D HAUS — Book and Get Book'd",
      // },
      {
        path: 'search',
        loadComponent: () => import('./pages/discover/discover.component').then((m) => m.DiscoverComponent),
        title: "Search — BOOK'D HAUS",
      },
      // FUTURE: Announcements
      // {
      //   path: 'announcements',
      //   loadComponent: () =>
      //     import('./pages/announcements/announcements-list.component').then((m) => m.AnnouncementsListComponent),
      //   title: "Announcements — BOOK'D HAUS",
      // },
      // {
      //   path: 'announcements/:id',
      //   loadComponent: () =>
      //     import('./pages/announcements/announcement-detail.component').then((m) => m.AnnouncementDetailComponent),
      //   title: "Announcement — BOOK'D HAUS",
      // },
      // FUTURE: Challenges & Events
      // {
      //   path: 'challenges',
      //   loadComponent: () =>
      //     import('./pages/challenges/challenges-list.component').then((m) => m.ChallengesListComponent),
      //   title: "Challenges & Events — BOOK'D HAUS",
      // },
      // {
      //   path: 'challenges/:slug',
      //   loadComponent: () =>
      //     import('./pages/challenges/challenge-detail.component').then((m) => m.ChallengeDetailComponent),
      //   title: "Challenge — BOOK'D HAUS",
      // },
      // FUTURE: Learning Hub
      // {
      //   path: 'learn',
      //   loadComponent: () => import('./pages/learn/learn-hub.component').then((m) => m.LearnHubComponent),
      //   title: "Learning Hub — BOOK'D HAUS",
      // },
      // {
      //   path: 'learn/:slug',
      //   loadComponent: () => import('./pages/learn/learn-article.component').then((m) => m.LearnArticleComponent),
      //   title: "Learn — BOOK'D HAUS",
      // },
      {
        path: 'pricing',
        loadComponent: () => import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
        title: "Membership & Pricing — BOOK'D HAUS",
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent),
        title: "About — BOOK'D HAUS",
      },
      {
        path: 'contact',
        loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent),
        title: "Contact — BOOK'D HAUS",
      },
      {
        path: 'profile/:id',
        loadComponent: () =>
          import('./pages/profile/profile-public.component').then((m) => m.ProfilePublicComponent),
        title: "Profile — BOOK'D HAUS",
      },
    ],
  },

  {
    path: 'auth',
    loadComponent: () => import('./layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () => import('./pages/auth/login.component').then((m) => m.LoginComponent),
        title: "Log In — BOOK'D HAUS",
      },
      {
        path: 'signup',
        loadComponent: () => import('./pages/auth/signup.component').then((m) => m.SignupComponent),
        title: "Apply — BOOK'D HAUS",
      },
      {
        path: 'apply',
        redirectTo: 'signup',
        pathMatch: 'full',
      },
    ],
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-overview.component').then((m) => m.DashboardOverviewComponent),
        title: 'Dashboard',
      },
      {
        path: 'bookings',
        canActivate: [approvedGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard-bookings.component').then((m) => m.DashboardBookingsComponent),
        title: 'My Bookings',
      },
      {
        path: 'messages',
        canActivate: [approvedGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard-messages.component').then((m) => m.DashboardMessagesComponent),
        title: 'Messages',
      },
      {
        path: 'notifications',
        canActivate: [approvedGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard-notifications.component').then(
            (m) => m.DashboardNotificationsComponent,
          ),
        title: 'Notifications',
      },
      {
        path: 'portfolio',
        canActivate: [talentGuard, approvedGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard-portfolio.component').then((m) => m.DashboardPortfolioComponent),
        title: 'My Portfolio',
      },
      // FUTURE: member announcements
      // {
      //   path: 'announcements',
      //   loadComponent: () =>
      //     import('./pages/dashboard/dashboard-announcements.component').then(
      //       (m) => m.DashboardAnnouncementsComponent,
      //     ),
      //   title: 'My Announcements',
      // },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-settings.component').then((m) => m.DashboardSettingsComponent),
        title: 'Profile',
      },
      {
        path: 'pay',
        canActivate: [talentGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard-pay.component').then((m) => m.DashboardPayComponent),
        title: 'Pay with Whish',
      },
    ],
  },

  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/admin-analytics.component').then((m) => m.AdminAnalyticsComponent),
        title: 'Admin — Control Room',
      },
      // FUTURE: Content (CMS)
      // {
      //   path: 'content',
      //   loadComponent: () => import('./pages/admin/admin-content.component').then((m) => m.AdminContentComponent),
      //   title: 'Admin — Content',
      // },
      {
        path: 'theme',
        loadComponent: () => import('./pages/admin/admin-theme.component').then((m) => m.AdminThemeComponent),
        title: 'Admin — Theme',
      },
      // FUTURE: Media Library
      // {
      //   path: 'media',
      //   loadComponent: () => import('./pages/admin/admin-media.component').then((m) => m.AdminMediaComponent),
      //   title: 'Admin — Media Library',
      // },
      {
        path: 'contacts',
        loadComponent: () => import('./pages/admin/admin-contacts.component').then((m) => m.AdminContactsComponent),
        title: 'Admin — Contacts',
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/admin/admin-categories.component').then((m) => m.AdminCategoriesComponent),
        title: 'Admin — Categories',
      },
      {
        path: 'countries',
        loadComponent: () =>
          import('./pages/admin/admin-countries.component').then((m) => m.AdminCountriesComponent),
        title: 'Admin — Countries',
      },
      // FUTURE: Announcements
      // {
      //   path: 'announcements',
      //   loadComponent: () =>
      //     import('./pages/admin/admin-announcements.component').then((m) => m.AdminAnnouncementsComponent),
      //   title: 'Admin — Announcements',
      // },
      // FUTURE: Events & Challenges
      // {
      //   path: 'events',
      //   loadComponent: () => import('./pages/admin/admin-events.component').then((m) => m.AdminEventsComponent),
      //   title: 'Admin — Events & Challenges',
      // },
      // FUTURE: Learning Hub
      // {
      //   path: 'learn',
      //   loadComponent: () => import('./pages/admin/admin-learn.component').then((m) => m.AdminLearnComponent),
      //   title: 'Admin — Learning Hub',
      // },
      {
        path: 'testimonials',
        loadComponent: () =>
          import('./pages/admin/admin-testimonials.component').then((m) => m.AdminTestimonialsComponent),
        title: 'Admin — Testimonials',
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/admin-users.component').then((m) => m.AdminUsersComponent),
        title: 'Admin — Users',
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./pages/admin/admin-payments.component').then((m) => m.AdminPaymentsComponent),
        title: 'Admin — Whish Payments',
      },
      {
        path: 'cancellations',
        loadComponent: () =>
          import('./pages/admin/admin-cancellations.component').then((m) => m.AdminCancellationsComponent),
        title: 'Admin — Cancelled Subscriptions',
      },
      {
        path: 'clients',
        loadComponent: () => import('./pages/admin/admin-clients.component').then((m) => m.AdminClientsComponent),
        title: 'Admin — Clients',
      },
      {
        path: 'bookings',
        loadComponent: () => import('./pages/admin/admin-bookings.component').then((m) => m.AdminBookingsComponent),
        title: 'Admin — Bookings',
      },
      {
        path: 'analytics',
        redirectTo: '',
        pathMatch: 'full',
      },
    ],
  },

  {
    path: 'book/:profileId',
    canActivate: [authGuard, approvedGuard],
    loadComponent: () => import('./pages/booking/booking-flow.component').then((m) => m.BookingFlowComponent),
    title: "Book a Creative — BOOK'D HAUS",
  },

  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: "Page Not Found — BOOK'D HAUS",
  },
];
