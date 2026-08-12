# Login Performance Troubleshooting Guide

## Current Bottlenecks Identified

### 1. **Development Mode Overhead**
- Running `npm run dev` is significantly slower than production
- Next.js recompiles on every request in dev mode
- **Solution**: Test in production build to compare

### 2. **Network Round-Trip Time**
- Every login makes an API call to `/api/auth/[...nextauth]`
- JWT token generation and validation
- **Typical time**: 100-500ms for local development

### 3. **JWT Processing**
- NextAuth creates and signs JWT tokens
- Without explicit `secret`, it generates one on each restart
- **Fixed**: Added explicit NEXTAUTH_SECRET configuration

## Performance Improvements Applied

✅ **Added explicit JWT configuration**
- Set `maxAge` for session and JWT
- Added `secret` reference to environment variable
- Disabled debug mode for production

✅ **Added early return for missing credentials**
- Prevents unnecessary processing

✅ **Added username to token**
- Reduces future session lookups

## Testing Login Performance

### Method 1: Browser DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Sign In"
4. Look for `/api/auth/callback/credentials` request
5. Check the "Time" column

**Expected times:**
- Development mode: 200-800ms
- Production mode: 50-200ms

### Method 2: Add Console Timing
Add this to your login page's `handleSubmit`:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  const startTime = performance.now();
  
  const result = await signIn('credentials', {
    redirect: false,
    username,
    password,
  });
  
  const endTime = performance.now();
  console.log(`Login took ${Math.round(endTime - startTime)}ms`);

  if (result?.error) {
    setError('Access Denied. Invalid credentials.');
    setLoading(false);
  } else {
    router.push('/dashboard');
    router.refresh();
  }
};
```

## Further Optimizations

### If still slow (> 1 second), try:

1. **Use Production Build**
   ```bash
   npm run build
   npm start
   ```

2. **Database Connection Pooling** (if checking users against DB in future)
   - Your current setup doesn't use database for auth (good!)
   - Keep credentials-based auth for admin

3. **Reduce Middleware Overhead**
   - Your middleware is already optimized with specific matchers

4. **Client-Side Optimization**
   - Consider removing `router.refresh()` if not needed
   - The refresh causes an additional server round-trip

5. **Check System Resources**
   - High CPU usage?
   - Low memory?
   - Other processes competing?

## Next.js 16 Specific Notes

⚠️ **You're using Next.js 16.3.0** - This is cutting edge!

Based on your AGENTS.md note, this version may have:
- Different caching behavior
- New compilation strategies
- Changed performance characteristics

Check Next.js 16 docs at: `node_modules/next/dist/docs/`

## Recommended Production Configuration

Create `.env.production`:

```env
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-a-new-secret-with: openssl rand -base64 32"
NODE_ENV="production"
```

## Common Issues & Solutions

### Issue: Login takes 3-5 seconds
**Cause**: Development mode + cold start
**Solution**: First login after `npm run dev` is always slower

### Issue: Subsequent logins still slow
**Cause**: No caching of session
**Solution**: Already using JWT strategy (fastest option)

### Issue: "Authenticating..." spinner shows for 2+ seconds
**Cause**: Multiple factors (network, processing, redirect)
**Solution**: Profile with DevTools Network tab

## Monitoring

Add this to track auth performance in production:

```javascript
// In lib/auth.js, add to authorize:
async authorize(credentials) {
  const startTime = Date.now();
  
  // ... your auth logic ...
  
  const duration = Date.now() - startTime;
  if (duration > 500) {
    console.warn(`Slow auth detected: ${duration}ms`);
  }
  
  return user;
}
```

## Contact Performance Baseline

**Your current setup should achieve:**
- First login (cold): 400-800ms
- Subsequent logins: 200-400ms
- Production build: 100-200ms

If you're seeing higher times, run the diagnostics above!
