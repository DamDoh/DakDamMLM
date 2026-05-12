# Fix for Withdrawal 503 Error (Service Unavailable)

## Problem
The withdrawal feature works locally but returns a 503 error on the server. This is caused by the Prisma client not being regenerated after deployment.

## Root Cause
When code is deployed to the server:
1. `npm install` runs but doesn't regenerate the Prisma client
2. The Prisma client is missing the `ecashWithdrawalRequest` model
3. The API checks for this model and returns 503 if it's not found

## Solution Applied

### 1. Added `postinstall` Script
Added to `package.json`:
```json
"postinstall": "prisma generate"
```
This ensures Prisma client is regenerated automatically after `npm install`.

### 2. Updated Build Script
Updated `package.json` build script:
```json
"build": "prisma generate && cross-env NODE_ENV=production next build"
```
This ensures Prisma client is generated before building the application.

### 3. Improved Error Handling
Enhanced error messages in the withdrawal API to:
- Log available Prisma models for debugging
- Provide clear instructions on how to fix the issue
- Include error codes for easier identification

## Deployment Steps

### On Your Server:

1. **Pull the latest code:**
   ```bash
   git pull origin manil  # or your branch name
   ```

2. **Install dependencies (this will now auto-generate Prisma client):**
   ```bash
   npm install
   ```
   The `postinstall` script will automatically run `prisma generate`.

3. **Run database migrations (if needed):**
   ```bash
   npx prisma migrate deploy
   ```
   Or if using `db push`:
   ```bash
   npx prisma db push
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```
   This will also regenerate Prisma client before building.

5. **Restart your server:**
   ```bash
   npm start
   # or
   pm2 restart your-app-name
   # or whatever process manager you're using
   ```

## Verification

After deployment, verify the fix:

1. **Check server logs** - Should see Prisma client generation messages
2. **Test the withdrawal endpoint:**
   ```bash
   curl -X GET https://your-server.com/api/ecash-withdrawal-requests \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   Should return 200 instead of 503.

3. **Check error logs** - If still getting 503, check logs for:
   - Available Prisma models
   - Prisma client version
   - Any database connection errors

## Troubleshooting

### If 503 persists:

1. **Manually regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

2. **Check Prisma schema is up to date:**
   ```bash
   npx prisma validate
   ```

3. **Verify database connection:**
   ```bash
   npx prisma db pull
   ```

4. **Check environment variables:**
   - Ensure `DATABASE_URL` is set correctly
   - Verify database is accessible from server

5. **Check server logs** for detailed error messages:
   - Look for "EcashWithdrawalRequest model not available"
   - Check available models list in logs
   - Verify Prisma client version

## Additional Notes

- The `postinstall` script runs automatically after `npm install`
- The build script now includes Prisma generation
- Error messages now include helpful debugging information
- All three API endpoints (GET, POST, PATCH) have improved error handling

## Prevention

To prevent this issue in the future:
- Always run `npm install` after pulling code (triggers postinstall)
- Ensure `prisma generate` runs in your CI/CD pipeline
- Include Prisma generation in your deployment scripts
- Monitor server logs for Prisma-related errors

