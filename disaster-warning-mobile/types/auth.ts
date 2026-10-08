/**
 * User role types matching the system actors from the case study.
 * - citizen: Regular citizen who receives warnings and submits ground reports.
 * - dmc_officer: DMC Duty Officer who issues warnings, verifies reports, generates reports.
 * - district_officer: District Officer who coordinates shelters, rescue teams, and relief supplies.
 * - volunteer: Community Disaster Volunteer who submits ground reports.
 */
export type UserRole = 'citizen' | 'dmc_officer' | 'district_officer' | 'volunteer';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  district?: string;
  phone?: string;
  organisation?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  district?: string;
  phone?: string;
  organisation?: string;
}

export interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
}
