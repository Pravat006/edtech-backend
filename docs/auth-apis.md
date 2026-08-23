# User Authentication APIs

This document lists all User Authentication APIs, their endpoints, and the expected JSON payloads for testing purposes.

## 1. Send OTP
*Used to initiate login, registration, or forgot password.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/otp/send`
- **Payload:**
```json
{
  "phoneNumber": "+919876543210"
}
```

## 2. Verify OTP
*Used to verify the phone number. Returns a `setupToken` valid for 15 mins to set a password, or auth tokens directly if bypassing password setup.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/otp/verify`
- **Payload:**
```json
{
  "phoneNumber": "+919876543210",
  "otp": "1234"
}
```

## 3. Login (Password-First)
*The daily login flow using phone number and password.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/login`
- **Payload:**
```json
{
  "phoneNumber": "+919876543210",
  "password": "your_secure_password"
}
```

## 4. Set / Reset Password
*Used immediately after Verify OTP. Requires the `setupToken` returned from the Verify OTP response.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/set-password` (or `/v1/auth/user/forgot-password` - they map to the same logic)
- **Payload:**
```json
{
  "setupToken": "jwt_token_from_otp_verify_step",
  "password": "your_new_password"
}
```

## 5. Setup Profile
*Used during initial onboarding to set name and email.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/profile`
- **Headers:** `Authorization: Bearer <access_token>`
- **Payload:**
```json
{
  "name": "Pravat Kumar",
  "email": "pravat@example.com"
}
```

## 6. Change Password (Authenticated)
*Used when a logged-in user wants to change their password from the Settings screen.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/change-password`
- **Headers:** `Authorization: Bearer <access_token>`
- **Payload:**
```json
{
  "oldPassword": "your_current_password",
  "newPassword": "your_new_password"
}
```

## 7. Refresh Tokens
*Used when the access token expires to get a new pair.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/token/refresh`
- **Payload:**
```json
{
  "token": "your_refresh_token_string"
}
```

## 8. Logout
*Invalidates the refresh token on the server.*
- **Method:** `POST`
- **Endpoint:** `/v1/auth/user/logout`
- **Payload:**
```json
{
  "refreshToken": "your_refresh_token_string"
}
```

---

# Admin Authentication APIs

> **Note on Admin Auth:** Unlike the User Auth which returns tokens in the JSON response, the Admin Auth uses **secure, HTTP-only cookies** (`admin_access_token` and `admin_refresh_token`) to manage session state. Your API client (e.g., Postman) must be configured to accept and send cookies automatically.

## 1. Admin Login
*Logs in an admin and sets HTTP-only cookies.*
- **Method:** `POST`
- **Endpoint:** `/v1/admin/auth/login`
- **Payload:**
```json
{
  "email": "admin@example.com",
  "password": "your_secure_password"
}
```

## 2. Admin Refresh Tokens
*Generates a new access token using the HTTP-only refresh token cookie.*
- **Method:** `POST`
- **Endpoint:** `/v1/admin/auth/refresh`
- **Payload:** *(Empty JSON object, relies on `admin_refresh_token` cookie)*
```json
{}
```

## 3. Admin Logout
*Clears the HTTP-only cookies and invalidates the session.*
- **Method:** `POST`
- **Endpoint:** `/v1/admin/auth/logout`
- **Payload:** *(Empty JSON object, relies on `admin_refresh_token` cookie)*
```json
{}
```
