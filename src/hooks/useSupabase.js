import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Custom hook for Supabase CRUD operations
 * @param {string} tableName - Supabase table name
 * @param {string} userId - Current user ID
 */
export const useSupabase = (tableName, userId) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            console.log(`[useSupabase] Fetching from ${tableName} for userId: ${userId}`);
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error(`[useSupabase] Error from ${tableName}:`, error);
                throw error;
            }
            console.log(`[useSupabase] Success ${tableName} data count:`, data?.length || 0);
            setData(data || []);
        } catch (err) {
            setError(err.message);
            console.error(`[useSupabase] Exception in ${tableName}:`, err);
        } finally {
            setLoading(false);
        }
    }, [tableName, userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addData = async (newItem) => {
        try {
            const { data: insertedData, error } = await supabase
                .from(tableName)
                .insert([{ ...newItem, user_id: userId }])
                .select();

            if (error) throw error;
            setData(prev => [...(insertedData || []), ...prev]);
            return insertedData[0];
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const addDataBulk = async (newItems) => {
        try {
            const itemsWithAuth = newItems.map(item => ({ ...item, user_id: userId }));
            const { data: insertedData, error } = await supabase
                .from(tableName)
                .insert(itemsWithAuth)
                .select();

            if (error) throw error;
            setData(prev => [...(insertedData || []), ...prev]);
            return insertedData;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const updateData = async (id, updates) => {
        try {
            const { error } = await supabase
                .from(tableName)
                .update(updates)
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
            setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const deleteData = async (id) => {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
            setData(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    return { data, loading, error, addData, addDataBulk, updateData, deleteData, refresh: fetchData };
};
