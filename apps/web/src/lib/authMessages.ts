export const UNAUTHORIZED_SIGNUP_MESSAGE = 'This email is not authorized to create an account';

export const UNAUTHORIZED_SIGNUP_USER_MESSAGE =
  'This email is not authorized to create an account. Contact the Amplifica team if you need access.';

export function formatAuthMessage(message: string): string {
  if (message === UNAUTHORIZED_SIGNUP_MESSAGE) {
    return UNAUTHORIZED_SIGNUP_USER_MESSAGE;
  }

  return message;
}
