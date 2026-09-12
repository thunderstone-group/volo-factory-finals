import { expect, test } from '@playwright/test';
import {
  expectSignedIn,
  expectSignedOut,
  expectVisibleFeedback,
  readVisibleFeedback,
  registerAccount,
  signIn,
  signOut,
  uniqueTicketBookingAccount,
} from './support/e2e';

test('REQ-1.2: sign in with a valid username and password', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.username, account.password);
  await expectSignedIn(page, account.username);
  await page.reload();
  await expectSignedIn(page, account.username);
});

test('REQ-1.2: sign in with a case-insensitive email and password', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.email.toUpperCase(), account.password);
  await expectSignedIn(page, account.username);
});

test('REQ-1.2: reject wrong password and incomplete credentials with the same generic error', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.username, 'incorrect-password');
  const genericCredentialError = /无效凭据|登录失败|账号或密码错误|凭据错误|invalid credentials|login failed|sign-in failed|incorrect (?:username|email|credentials|password)|wrong (?:username|email|credentials|password)/i;
  await expectVisibleFeedback(page, genericCredentialError);
  const wrongPasswordMessage = await readVisibleFeedback(page, genericCredentialError);
  await expectSignedOut(page);
  await expect(page.getByRole('link', { name: /退出登录|sign out/i })).not.toBeVisible();

  await signIn(page, account.username, '');
  await expectVisibleFeedback(page, genericCredentialError);
  await expect.poll(() => readVisibleFeedback(page, genericCredentialError)).toBe(wrongPasswordMessage);
  await expectSignedOut(page);
  await expect(page.getByRole('link', { name: /退出登录|sign out/i })).not.toBeVisible();
});

test('REQ-1.2: reject an unknown account and stay logged out', async ({ page }) => {
  const account = uniqueTicketBookingAccount();
  const unknownAccount = `unknown-${Date.now()}@example.test`;

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.username, 'incorrect-password');
  const genericCredentialError = /无效凭据|登录失败|账号或密码错误|凭据错误|invalid credentials|login failed|sign-in failed|incorrect (?:username|email|credentials|password)|wrong (?:username|email|credentials|password)/i;
  await expectVisibleFeedback(page, genericCredentialError);
  const wrongPasswordMessage = await readVisibleFeedback(page, genericCredentialError);

  await signIn(page, unknownAccount, account.password);
  await expectVisibleFeedback(page, genericCredentialError);
  await expect.poll(() => readVisibleFeedback(page, genericCredentialError)).toBe(wrongPasswordMessage);
  await expectSignedOut(page);
  await expect(page.getByText(/账号不存在|用户不存在|not found|unknown account|does not exist/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /退出登录|sign out/i })).not.toBeVisible();
});
