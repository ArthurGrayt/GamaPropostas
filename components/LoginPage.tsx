import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { logAction } from '../services/logger';
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            await logAction('LOGIN', 'Realizou login no sistema');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-50 dark:bg-black transition-colors duration-500 font-sans selection:bg-blue-500/30">

            {/* Dynamic Background Blobs */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-teal-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-blue-500/10 rounded-full blur-[150px] animate-pulse-slow delay-1000"></div>
                <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-emerald-500/5 rounded-full blur-[100px] animate-pulse-slow delay-500"></div>
            </div>

            {/* Main Card */}
            <div className="relative z-10 w-full max-w-md p-6">
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-black/40 border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl p-8 sm:p-12 transition-all duration-300 hover:shadow-teal-500/5">

                    {/* Header */}
                    <div className="text-center mb-10 flex flex-col items-center">
                        <div className="w-24 h-24 mb-6 relative hover:scale-105 transition-transform duration-300">
                            <img
                                src="/gama-logo.png"
                                alt="Gama Logo"
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
                            Gama <span className="text-teal-600 font-light">Propostas</span>
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Gerenciamento Corporativo
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 bg-zinc-100/50 dark:bg-zinc-900/50 border border-transparent dark:border-white/5 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:bg-white dark:focus:bg-black transition-all"
                                    placeholder="Seu e-mail corporativo"
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 bg-zinc-100/50 dark:bg-zinc-900/50 border border-transparent dark:border-white/5 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:bg-white dark:focus:bg-black transition-all"
                                    placeholder="Sua senha"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full relative group overflow-hidden bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                            <div className="flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Autenticando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Entrar no Sistema</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-xs text-zinc-400 dark:text-zinc-600">
                            &copy; {new Date().getFullYear()} Gama. Acesso Restrito.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
