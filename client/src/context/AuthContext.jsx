import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  loginUser,
  registerUser,
  logoutUser,
  getStoredUser,
  fetchProfile
} from '../api/tutorApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('tutor_token');
      if (token) {
        try {
          const profileData = await fetchProfile();
          setUser(profileData.user);
          localStorage.setItem('tutor_user', JSON.stringify(profileData.user));
        } catch (err) {
          console.warn('Auth token invalid or expired, resetting session.');
          logoutUser();
          setUser(null);
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const login = async (credential, password) => {
    const res = await loginUser(credential, password);
    setUser(res.user);
    return res;
  };

  const register = async (username, email, password) => {
    const res = await registerUser(username, email, password);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const updateUserDifficulty = (newDifficulty) => {
    setUser((prev) => (prev ? { ...prev, currentDifficulty: newDifficulty } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        updateUserDifficulty
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
