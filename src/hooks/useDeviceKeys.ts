/**
 * Hook for managing device keypairs for E2EE.
 * Generates keypair on first use, registers public key with server.
 * Private key stays in IndexedDB only.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateKeyPair, initCrypto, getDeviceName } from '@/lib/crypto';
import { storeKeyPair, getKeyPairByUser, deleteKeyPair as deleteStoredKeyPair } from '@/lib/keyStore';

interface DeviceKeyState {
  deviceId: string | null;
  publicKey: string | null;
  privateKey: string | null;
  loading: boolean;
  error: string | null;
}

export function useDeviceKeys() {
  const { user } = useAuth();
  const [state, setState] = useState<DeviceKeyState>({
    deviceId: null,
    publicKey: null,
    privateKey: null,
    loading: true,
    error: null,
  });

  const initializeDeviceKeys = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      await initCrypto();

      // Check if we already have a keypair stored locally
      const stored = await getKeyPairByUser(user.id);
      
      if (stored) {
        // Verify the device still exists on server (maybeSingle avoids throwing on 0 rows)
        const { data: device, error: verifyErr } = await (supabase as any)
          .from('devices')
          .select('id, device_public_key')
          .eq('id', stored.deviceId)
          .eq('user_id', user.id)
          .maybeSingle();

        // If the verify query itself failed (network/RLS), trust local keys rather than blocking
        if (verifyErr) {
          setState({
            deviceId: stored.deviceId,
            publicKey: stored.publicKey,
            privateKey: stored.privateKey,
            loading: false,
            error: null,
          });
          return;
        }

        if (device) {
          setState({
            deviceId: stored.deviceId,
            publicKey: stored.publicKey,
            privateKey: stored.privateKey,
            loading: false,
            error: null,
          });

          // Update last_seen_at (fire-and-forget)
          (supabase as any)
            .from('devices')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', stored.deviceId)
            .then(() => {}, () => {});
          return;
        }

        // Device row was deleted on the server. Keep the local keypair in
        // IndexedDB anyway — old messages were encrypted to it and
        // useDecryptMessage tries every stored key, so deleting it would
        // permanently lose message history on this device.
      }

      // Generate new keypair
      const keyPair = await generateKeyPair();
      const deviceName = getDeviceName();

      // Register public key on server
      const { data: newDevice, error: insertError } = await (supabase as any)
        .from('devices')
        .insert({
          user_id: user.id,
          device_name: deviceName,
          device_public_key: keyPair.publicKey,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Store keypair locally (private key never leaves device)
      await storeKeyPair(newDevice.id, user.id, keyPair.publicKey, keyPair.privateKey);

      setState({
        deviceId: newDevice.id,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to initialize device keys:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to initialize encryption',
      }));
    }
  }, [user]);

  useEffect(() => {
    initializeDeviceKeys();
  }, [initializeDeviceKeys]);

  // Get another user's device public key (via SECURITY DEFINER RPC — no enumeration)
  const getRecipientPublicKey = useCallback(async (userId: string): Promise<string | null> => {
    const { data } = await (supabase as any).rpc('get_recipient_device_public_key', {
      _user_id: userId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    return row?.device_public_key || null;
  }, []);

  // Get EVERY active device public key for a user so senders can fan-out one
  // encrypted blob per device — this is how a message decrypts on every
  // signed-in device instead of only the newest one.
  const getAllRecipientDeviceKeys = useCallback(
    async (userId: string): Promise<Array<{ id: string; device_public_key: string }>> => {
      const { data, error } = await (supabase as any).rpc('get_all_recipient_device_keys', {
        _user_id: userId,
      });
      if (error || !Array.isArray(data)) return [];
      return data;
    },
    [],
  );

  // List user's devices
  const listDevices = useCallback(async () => {
    if (!user) return [];
    const { data } = await (supabase as any)
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });
    return data || [];
  }, [user]);

  // Remove a device
  const removeDevice = useCallback(async (deviceId: string) => {
    await (supabase as any).from('devices').delete().eq('id', deviceId);
    await deleteStoredKeyPair(deviceId);
    if (state.deviceId === deviceId) {
      // Re-initialize with new keypair
      await initializeDeviceKeys();
    }
  }, [state.deviceId, initializeDeviceKeys]);

  return {
    ...state,
    getRecipientPublicKey,
    getAllRecipientDeviceKeys,
    listDevices,
    removeDevice,
    reinitialize: initializeDeviceKeys,
  };
}
