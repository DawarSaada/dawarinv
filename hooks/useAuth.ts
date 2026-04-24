import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { User, LocationData } from '../types';
import { supabase } from '../services/supabase';
import { generateId } from '../constants';

export const useAuth = (requestNotificationPermission: () => void) => {
  const [users, setUsers] = useState<User[]>([]);
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

  const handleCreateUser = useCallback(async (newUser: Omit<User, 'id'>, setLocations: Dispatch<SetStateAction<LocationData[]>>) => {
    const tempId = generateId();
    // Optimistic Update
    const user: User = { ...newUser, id: tempId };
    setUsers(prev => [...prev, user]);

    if (newUser.role === 'branch_manager' && newUser.branchCode) {
        const newLoc: LocationData = {
            id: newUser.branchCode,
            name: newUser.branchName || newUser.branchCode,
            nameAr: newUser.branchNameAr || newUser.branchName || newUser.branchCode,
            description: 'Branch Inventory',
            icon: 'store',
            type: 'branch'
        };
        setLocations(prev => {
            if (prev.some(l => l.id === newLoc.id)) return prev;
            return [...prev, newLoc];
        });
    }

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
        accessible_branches: newUser.accessibleBranches || []
    }]).select();
    
    if (!error && data && data[0]) {
        const realUser: User = {
            id: data[0].id,
            username: data[0].username,
            password: data[0].password,
            name: data[0].name,
            nameAr: data[0].name_ar,
            role: data[0].role,
            branchCode: data[0].branch_code,
            branchName: data[0].branch_name,
            branchNameAr: data[0].branch_name_ar,
            accessibleBranches: data[0].accessible_branches
        };
        setUsers(prev => prev.map(u => u.id === tempId ? realUser : u));
    }
  }, []);

  const handleEditUser = useCallback(async (updatedUser: User, setLocations: Dispatch<SetStateAction<LocationData[]>>) => {
      // Optimistic Update
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));

      if (updatedUser.role === 'branch_manager' && updatedUser.branchCode) {
          const newLoc: LocationData = {
              id: updatedUser.branchCode,
              name: updatedUser.branchName || updatedUser.branchCode,
              nameAr: updatedUser.branchNameAr || updatedUser.branchName || updatedUser.branchCode,
              description: 'Branch Inventory',
              icon: 'store',
              type: 'branch'
          };
          setLocations(prev => {
              const exists = prev.some(l => l.id === newLoc.id);
              if (exists) {
                  return prev.map(l => l.id === newLoc.id ? { ...l, name: newLoc.name, nameAr: newLoc.nameAr } : l);
              }
              return [...prev, newLoc];
          });
      }

      const updates: any = {
        username: updatedUser.username,
        name: updatedUser.name,
        name_ar: updatedUser.nameAr,
        role: updatedUser.role,
        branch_code: updatedUser.branchCode,
        branch_name: updatedUser.branchName,
        branch_name_ar: updatedUser.branchNameAr,
        accessible_branches: updatedUser.accessibleBranches || []
      };

      if (updatedUser.password && updatedUser.password.trim() !== '') {
          updates.password = updatedUser.password;
      }

      await supabase.from('app_users').update(updates).eq('id', updatedUser.id).then(({error}) => { if (error) throw error; });
  }, []);

  const handleDeleteUser = useCallback(async (id: string) => {
    // Optimistic Update
    setUsers(prev => prev.filter(u => u.id !== id));
    await supabase.from('app_users').delete().eq('id', id).then(({error}) => { if (error) throw error; });
  }, []);

  return {
    users,
    setUsers,
    currentUser,
    setCurrentUser,
    handleLogin,
    handleLogout,
    handleCreateUser,
    handleEditUser,
    handleDeleteUser
  };
};
