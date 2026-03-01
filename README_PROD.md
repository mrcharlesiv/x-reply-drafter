# X Reply Drafter - Productized Edition

Complete, production-ready implementation of the X Reply Drafter Chrome extension with landing page, backend API, authentication, and subscription management.

## 📦 Project Structure

```
x-reply-drafter/              # Chrome Extension
├── manifest.json             # Extension configuration
├── content.js               # Content script for X/Twitter
├── background.js            # Service worker (handles API calls)
├── options.html/js/css      # Extension settings page
├── popup.html/js/css        # Extension popup
├── auth.html/js/css         # Login/signup popup
├── icons/                   # Extension icons (16, 32, 48, 128)
└── CHROME_STORE_DESCRIPTION.md

x-reply-drafter-site/        # Next.js Landing Page + API Backend
├── src/app/
│   ├── page.tsx            # Landing page
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   ├── privacy/page.tsx    # Privacy policy
│   ├── terms/page.tsx      # Terms of service
│   └── api/
│       ├── auth/
│       │   └── register/route.ts
│       ├── drafts/
│       │   └── generate/route.ts
│       ├── stripe/
│       │   └── create-checkout/route.ts
│       └── webhooks/
│           └── stripe/route.ts
├── src/components/
│   ├── hero.tsx            # Hero section with animation
│   ├── features.tsx        # Features showcase
│   ├── pricing.tsx         # Pricing section
│   ├── faq.tsx            # FAQ section
│   └── footer.tsx         # Footer
├── src/lib/
│   └── supabase.ts        # Supabase client
├── supabase-schema.sql    # Database schema
├── next.config.js
├── tailwind.config.js
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Chrome/Chromium browser
- Supabase account
- Stripe account (for payments)
- Anthropic API key (for Pro tier) or user's own API key (Free tier)

### Environment Setup

1. **Landing Site + Backend**

```bash
cd x-reply-drafter-site
cp .env.local.example .env.local
# Edit .env.local with your Supabase and Stripe keys
npm install
npm run dev  # Runs on http://localhost:3000
```

2. **Extension Setup**

```bash
cd x-reply-drafter
# Load unpacked extension in Chrome:
# chrome://extensions/ → "Load unpacked" → select x-reply-drafter folder
```

## 🔐 Authentication Flow

### User Registration
1. User clicks "Add to Chrome - It's Free" → Opens auth.html
2. User signs up with email/password
3. Backend creates user in Supabase (Free plan, 0 usage)
4. Auth token stored in `chrome.storage.local`
5. Extension auto-authenticates future requests

### Draft Generation (Authenticated)
1. User clicks "Draft Reply" button on X
2. Content script reads tweet and sends to background.js
3. Background checks for auth token in local storage
4. If authenticated:
   - Calls `/api/drafts/generate` with token
   - Backend verifies token, checks plan limits
   - Anthropic Claude generates drafts
   - Returns to extension
5. If not authenticated:
   - Falls back to local API key method (if configured)

### Subscription Flow
1. User clicks "Upgrade to Pro" on settings page
2. Opens `/api/stripe/create-checkout`
3. Stripe session created with user ID in metadata
4. User pays via Stripe
5. Stripe webhook updates user plan to "pro"
6. Extension detects plan change in next request

## 🗄️ Database Schema

### Users Table
```sql
- id (UUID, PK, from auth)
- email (TEXT, UNIQUE)
- name (TEXT)
- plan (TEXT: 'free', 'pro', 'team')
- stripe_subscription_id (TEXT)
- usage_count (INT, daily)
- usage_reset_date (TIMESTAMP)
- created_at, updated_at
```

### Supporting Tables
- `saved_prompts` - User's saved reply templates
- `draft_history` - History of generated drafts
- `custom_personas` - User-defined reply personas
- `analytics` - Event tracking for analytics dashboard

All tables use RLS (Row Level Security) for user isolation.

## 💰 Pricing Tiers

### Free
- 10 drafts/day
- Bring your own API key (Anthropic/OpenAI)
- 3 prompt presets
- Basic personas
- Community support

### Pro ($12/month)
- Unlimited drafts
- AI included (Claude 3.5 Sonnet)
- Unlimited saved prompts
- All personas + custom personas
- Priority email support
- Usage analytics

### Team ($29/month)
- Everything in Pro
- 5 team seats
- Shared prompt libraries
- Team analytics dashboard
- Dedicated support
- Admin controls

## 🔌 API Routes

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Authenticate user (future)
- `GET /api/auth/me` - Get current user (future)

### Drafts
- `POST /api/drafts/generate` - Generate reply drafts
  - Required: auth token, tweetText
  - Optional: persona, model
  - Returns: 3 draft alternatives, usage stats

### Billing
- `POST /api/stripe/create-checkout` - Create Stripe session
- `POST /api/webhooks/stripe` - Webhook for subscription events

## 📊 Key Features

### Smart Reply Generation
- Uses Claude 3.5 Sonnet for high-quality drafts
- Persona-based generation (Professional, Casual, Witty, etc.)
- Context-aware (considers quoted tweets)
- Rate limited (1 request per 1.5 seconds to API)

### Saved Prompts
- Users can save any draft as a prompt template
- Pro users: unlimited saved prompts
- Free users: 3 preset prompts included
- Quickly regenerate with same style

### Analytics Dashboard (Pro+)
- Daily/weekly usage charts
- Most-used personas and prompts
- Performance metrics
- Team analytics (Team plan)

## 🚀 Deployment

### Landing Site
```bash
# Deploy to Vercel (recommended)
npm i -g vercel
vercel

# Or use your own hosting
npm run build  # Creates .next/
# Deploy the .next folder to your host
```

### Supabase Setup
1. Create Supabase project
2. Run `supabase-schema.sql` in SQL editor
3. Enable Email Auth in Authentication settings
4. Set up Google OAuth (optional)

### Stripe Setup
1. Create Stripe account (use test keys for development)
2. Create products for Pro ($12) and Team ($29) plans
3. Set webhook endpoint to `/api/webhooks/stripe`
4. Add Stripe keys to `.env.local`

### Chrome Web Store
1. Create developer account ($5 one-time fee)
2. Upload extension with screenshots
3. Submit for review (2-3 hours typically)
4. Once approved, users can install from Chrome Web Store

## 🛠️ Development

### Adding New Features
1. **Extension**: Modify `content.js` (UI) or `background.js` (logic)
2. **API**: Add routes in `src/app/api/`
3. **Database**: Update `supabase-schema.sql` and apply changes
4. **Frontend**: Update components in `src/components/`

### Testing
- Extension: Load unpacked, test in Chrome
- API: Test routes with cURL or Postman
- Auth: Test with multiple accounts
- Payments: Use Stripe test cards (4242...)

### Analytics Tracking
Add events to the `analytics` table:
```javascript
// Example: User generates draft
await supabase.from('analytics').insert({
  user_id,
  event_type: 'draft_generated',
  event_data: { persona, draft_count: 3 }
});
```

## 🔒 Security Checklist

- [ ] Enable HTTPS on production domain
- [ ] Set environment variables securely
- [ ] Enable RLS on all Supabase tables
- [ ] Rotate API keys regularly
- [ ] Monitor API usage for abuse
- [ ] Implement rate limiting
- [ ] Add CORS headers appropriately
- [ ] Use secure session cookies
- [ ] Validate all user inputs on backend
- [ ] Implement request signing (optional)

## 📈 Growth Opportunities

1. **Social Proof**: Add testimonials and case studies
2. **Affiliate Program**: Commission for referrals
3. **API Access**: Allow developers to build on top
4. **Browser Extensions**: Safari, Firefox versions
5. **Web App**: Non-extension version for web
6. **LinkedIn/Threads**: Expand to other platforms
7. **Premium Personas**: Sell specialized personas
8. **Usage Analytics**: Dashboard for paid users
9. **Reply Templates Marketplace**: Sell/share templates
10. **AI Model Options**: GPT-4, other Claude models

## 🐛 Known Issues & TODOs

### TODOs
- [ ] Add login route for returning users
- [ ] Implement Google OAuth flow
- [ ] Add email verification for new accounts
- [ ] Create admin dashboard for analytics
- [ ] Implement rate limiting on API
- [ ] Add usage meter to extension popup
- [ ] Create team management UI
- [ ] Implement draft favoriting system
- [ ] Add A/B testing for persona selection
- [ ] Create referral program

### Known Limitations
- Free tier capped at 10 drafts/day
- Max 3 drafts per request (could increase)
- No offline mode (requires internet)
- No mobile app yet

## 📞 Support

For issues or questions:
- Email: support@x-reply-drafter.com
- GitHub Issues: [Link to repo]
- Twitter: @x_reply_drafter

## 📄 License

[Add license here - MIT, etc.]

---

**Built with ❤️ for X creators everywhere**
