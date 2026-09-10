import { PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event) => {
  // 1. Auto-confirm the user account instantly
  event.response.autoConfirmUser = true;

  // 2. Mark the email as verified so Cognito allows email-based sign-in/password resets
  if (event.request.userAttributes.hasOwnProperty('email')) {
    event.response.autoVerifyEmail = true;
  }

  // 3. (Optional) Auto-verify phone number if present
//   if (event.request.userAttributes.hasOwnProperty('phone_number')) {
//     event.response.autoVerifyPhone = true;
//   }

  return event;
};



// export const handler: PreSignUpTriggerHandler = async (event) => {
//   console.log('Received Cognito Pre-Sign-Up event:', JSON.stringify(event, null, 2))

//   const email = event.request.userAttributes.email
//   if (!email) {
//     throw new Error('Email attribute is missing from the sign-up request.')
//   }

//   const domain = email.split('@')[1]?.toLowerCase()

//   // Business Logic: Block bad domains
//   const blockedDomains = ['mailinator.com', 'tempmail.com']
//   if (blockedDomains.includes(domain)) {
//     // Throwing an error natively rejects the sign-up request in Cognito
//     throw new Error('Disposable email addresses are not permitted.')
//   }

//   // Business Logic: Auto-verify certain enterprise domains
//   if (domain === 'partner-company.com') {
//     event.response.autoConfirmUser = true
//     event.response.autoVerifyEmail = true
//   }

//   // CRITICAL: Always return the mutated or original event object back to Cognito
//   return event
// }
