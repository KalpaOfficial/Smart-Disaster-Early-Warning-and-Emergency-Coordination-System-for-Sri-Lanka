import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';
import { profileCache, signUp, signIn } from '@/services/authService';
import type { SignupData, UserRole } from '@/types/auth';

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
}));

const citizen: SignupData = {
  fullName: '  Citizen Name  ',
  email: '  citizen@example.test  ',
  password: 'Citizen123!',
  confirmPassword: 'Citizen123!',
  role: 'citizen',
  district: 'Gampaha',
  phone: '+94771234567',
};

beforeEach(() => {
  jest.useFakeTimers();
  profileCache.clear();
  (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: { uid: 'new-citizen' } });
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  (signOut as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('registers only a citizen profile with their selected district', async () => {
  const user = await signUp(citizen);
  expect(user).toMatchObject({
    id: 'new-citizen',
    fullName: 'Citizen Name',
    email: 'citizen@example.test',
    role: 'citizen',
    district: 'Gampaha',
    organisation: '',
  });
  expect(setDoc).toHaveBeenCalledWith(
    { collection: 'users', id: 'new-citizen' },
    expect.objectContaining({ role: 'citizen', district: 'Gampaha' })
  );
  expect(profileCache.get(user.id)?.role).toBe('citizen');
});

it.each(['dmc_officer', 'district_officer', 'volunteer'])(
  'rejects forged %s registration before creating an Auth account',
  async role => {
    await expect(signUp({ ...citizen, role } as unknown as SignupData)).rejects.toThrow(
      'citizens only'
    );
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  }
);

it.each([
  { fullName: ' ' },
  { email: 'invalid' },
  { district: '' },
  { district: 'Invalid District' },
  { password: 'short', confirmPassword: 'short' },
  { confirmPassword: 'different' },
])('rejects invalid registration input before creating an account: %p', async changes => {
  await expect(signUp({ ...citizen, ...changes })).rejects.toThrow();
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
});

it('does not grant officer access based on the registration email', async () => {
  const user = await signUp({ ...citizen, email: 'dmc.officer@example.test' });
  expect(user.role).toBe('citizen');
});

it('never auto-registers an account after a failed sign-in', async () => {
  const failure = Object.assign(new Error('Invalid credentials'), {
    code: 'auth/invalid-credential',
  });
  (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(failure);
  await expect(
    signIn({ email: 'dmc.officer@example.test', password: 'Password123!' })
  ).rejects.toBe(failure);
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  expect(setDoc).not.toHaveBeenCalled();
});

it.each<UserRole>(['citizen', 'volunteer', 'dmc_officer', 'district_officer'])(
  'allows an existing %s account to sign in with its stored role',
  async role => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: { uid: 'existing-user' },
    });
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ id: 'stale-id', fullName: 'Existing User', role }),
    });
    const user = await signIn({ email: 'user@example.test', password: 'Password123!' });
    expect(user.id).toBe('existing-user');
    expect(user.role).toBe(role);
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  }
);

it('refuses access when no provisioned profile exists, without creating an officer profile', async () => {
  (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
    user: { uid: 'missing-profile' },
  });
  (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
  await expect(
    signIn({ email: 'dmc.officer@example.test', password: 'Password123!' })
  ).rejects.toThrow('profile is unavailable');
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(setDoc).not.toHaveBeenCalled();
  expect(profileCache.has('missing-profile')).toBe(false);
});
