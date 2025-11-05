# Deploying to Vercel

This guide will help you deploy the CASA website to Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier is sufficient)
- The [Vercel CLI](https://vercel.com/docs/cli) installed (optional, for CLI deployment)

## Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub** (if not already done)
   - All configuration files are already in place

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your `casa-web` repository from GitHub

3. **Configure Environment Variables**
   - In the project settings, add these environment variables:
     ```
     VITE_SUPABASE_URL=https://mulsqxfhxxdsadxsljss.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8
     ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically detect the Vite framework and use the correct build settings

5. **Configure Custom Domain** (optional)
   - Go to Project Settings → Domains
   - Add `iglesia-casa.cl` as a custom domain
   - Follow Vercel's instructions to update your DNS records

## Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # For production deployment
   vercel --prod

   # Follow the prompts to configure your project
   ```

4. **Set Environment Variables**
   ```bash
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_ANON_KEY production
   ```

## Project Configuration

The following files have been configured for Vercel deployment:

- **vercel.json**: Vercel-specific configuration
  - Sets build command and output directory
  - Configures SPA routing (all routes redirect to index.html)
  - Sets cache headers for optimized asset delivery

- **.env.example**: Template for environment variables
  - Copy this to `.env.local` for local development
  - Set actual values in Vercel dashboard for production

- **src/integrations/supabase/client.ts**: Updated to use environment variables
  - Falls back to hardcoded values if env vars not set
  - Ensures compatibility with both local dev and Vercel deployment

## Automatic Deployments

Once connected to GitHub:
- Every push to the `main` branch triggers a production deployment
- Every push to other branches creates a preview deployment
- Pull requests get automatic preview URLs

## Custom Domain Setup

To use your custom domain `iglesia-casa.cl`:

1. In Vercel Dashboard, go to your project
2. Navigate to Settings → Domains
3. Add `iglesia-casa.cl` and `www.iglesia-casa.cl`
4. Update your DNS records with your domain registrar:
   - For `iglesia-casa.cl`: Add an A record pointing to Vercel's IP
   - For `www.iglesia-casa.cl`: Add a CNAME record pointing to `cname.vercel-dns.com`
5. Vercel will automatically provision an SSL certificate

## Troubleshooting

### Build Fails
- Check that all environment variables are set correctly in Vercel dashboard
- Verify Node.js version (Vercel uses Node 18+ by default)

### 404 Errors on Refresh
- This should be handled by the `vercel.json` rewrite rules
- If issues persist, check that `vercel.json` is committed to your repo

### Supabase Connection Issues
- Verify environment variables are set correctly
- Check Supabase dashboard to ensure the project is active
- Verify the API URL and anon key are correct

## Support

For more information:
- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
