import { supabase } from './supabaseClient';

const APP_ID = 3;
let cachedAppName: string | null = null;

// Helper to fetch app name dynamically
const getAppName = async (): Promise<string> => {
    if (cachedAppName) return cachedAppName;

    try {
        const { data, error } = await supabase
            .from('gamahub_apps')
            .select('nome')
            .eq('id', APP_ID)
            .single();

        if (error || !data) {
            console.error('Error fetching app name from gamahub_apps:', error);
            // Even if error, we don't want to crash, but the user wants to ensure we get it.
            // If we fail, we still return a fallback but log the error clearly.
            return 'App Desconhecido';
        }

        const fetchedName = (data as any).nome;

        if (fetchedName) {
            cachedAppName = fetchedName;
            return fetchedName;
        }

        return 'App Sem Nome';
    } catch (error) {
        console.error('Exception fetching app name:', error);
        return 'Erro ao obter nome';
    }
};

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';

export const logAction = async (
    action: LogAction,
    logtxt: string,
    metadata?: any
) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.warn('Attempted to log action without authenticated user:', action);
            return;
        }

        const appName = await getAppName();

        // Fetch username from 'users' table using user_id
        let username = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
        try {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('username')
                .eq('user_id', user.id)
                .single();

            if (!userError && userData && userData.username) {
                username = userData.username;
            }
        } catch (uErr) {
            console.warn('Failed to fetch username from DB, falling back to auth metadata', uErr);
        }
        // Fallback if still unknown
        if (!username) username = 'Usuário Desconhecido';

        const payload = {
            user_uuid: user.id,
            username: username,
            logtxt: logtxt,
            app_id: APP_ID,
            appname: appName,
            action: action
        };

        const { error } = await supabase
            .from('logs')
            .insert([payload]);

        if (error) {
            console.error('Failed to insert log:', error);
        } else {
            console.log(`[LOG] ${action}: ${logtxt} (App: ${appName})`);
        }

    } catch (e) {
        console.error('Exception in logAction:', e);
    }
};
