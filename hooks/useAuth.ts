import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { User, LocationData } from '../types';
import { supabase } from '../services/supabase';
import { generateId } from '../constants';

export const useAuth = (requestNotificationPermission: () => void, fetchedUsers: User[]) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
      const saved = localStorage.getItem('dawar_user');
      const expiry = localStorage.getItem('dawar_session_expiry');
      if (saved && expiry && Date.now() < parseInt(expiry, 10)) {
          return JSON.parse(saved);
      }
      localStorage.removeItem('dawar_user');
      localStorage.removeItem('dawar_session_expiry');
      return null;
  });

  // Sync currentUser with fetchedUsers in case Admin updates permissions remotely
  React.useEffect(() => {
    if (currentUser && fetchedUsers.length > 0) {
      const freshUser = fetchedUsers.find(u => u.id === currentUser.id);
      if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(freshUser);
        localStorage.setItem('dawar_user', JSON.stringify(freshUser));
      }
    }
  }, [fetchedUsers, currentUser]);

  const handleLogin = useCallback((user: User, rememberMe: boolean, setSelectedLocation: (loc: string | null) => void) => {
    setCurrentUser(user);
    requestNotificationPermission();

    // Session persistence logic
    const duration = rememberMe 
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 60 * 60 * 1000; // 1 hour
      
    const expiry = Date.now() + duration;
    localStorage.setItem('dawar_user', JSON.stringify(user));
    localStorage.setItem('dawar_session_expiry', expiry.toString());

    if (user.role === 'warehouse_manager') {
       setSelectedLocation(null);
    } else if (user.role === 'branch_manager') {
       setSelectedLocation(user.branchCode || null);
    } else if (user.role === 'mammal_employee') {
       setSelectedLocation('mammal');
    } else {
      setSelectedLocation(null);
    }
  }, [requestNotificationPermission]);

  const handleLogout = useCallback((setSelectedLocation: (loc: string | null) => void, clearNotifications: () => void) => {
    setCurrentUser(null);
    setSelectedLocation(null);
    clearNotifications();
    localStorage.removeItem('dawar_user');
    localStorage.removeItem('dawar_session_expiry');
  }, []);

  const handleCreateUser = useCallback(async (newUser: Omit<User, 'id'>) => {
    // Async Backend Call
    const { data, error } = await supabase.from('app_users').insert([{
        username: newUser.username,
        password: newUser.password,
        name: newUser.name,
        name_ar: newUser.nameAr,
        role: newUser.role,
        branch_code: newUser.branchCode,
        branch_name: newUser.branchName,
        branch_name_ar: newUser.branchNameAr,
        accessible_branches: [
           ...(newUser.accessibleBranches || []),
           ...(newUser.readOnlyBranches || []).map(b => `${b}:read`)
        ]
    }]).select();
    if (error) {
        console.error("Error creating user:", error);
        throw error;
    }
  }, []);

  const handleEditUser = useCallback(async (updatedUser: User) => {

      const updates: any = {
        username: updatedUser.username,
        name: updatedUser.name,
        name_ar: updatedUser.nameAr,
        role: updatedUser.role,
        branch_code: updatedUser.branchCode,
        branch_name: updatedUser.branchName,
        branch_name_ar: updatedUser.branchNameAr,
        accessible_branches: [
           ...(updatedUser.accessibleBranches || []),
           ...(updatedUser.readOnlyBranches || []).map(b => `${b}:read`)
        ]
      };

      if (updatedUser.password && updatedUser.password.trim() !== '') {
          updates.password = updatedUser.password;
      }

      await supabase.from('app_users').update(updates).eq('id', updatedUser.id).then(({error}) => { if (error) throw error; });
  }, []);

  const handleDeleteUser = useCallback(async (userId: string) => {
      const { error } = await supabase.from('app_users').delete().eq('id', userId);
      if (error) throw error;
  }, []);

  return {
    users: fetchedUsers,
    setUsers: () => {}, // No-op
    currentUser,
    setCurrentUser,
    handleLogin,
    handleLogout,
    handleCreateUser,
    handleEditUser,
    handleDeleteUser
  };
};
