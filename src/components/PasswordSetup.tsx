import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { KeyIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, UserIcon, Upload } from 'lucide-react';

type SetupStep = 'password' | 'profile' | 'complete';

export function PasswordSetup() {
  const [step, setStep] = useState<SetupStep>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  useEffect(() => {
    async function checkToken() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const tokenHash = params.get('token_hash');
      const token = params.get('token');
      const type = params.get('type');

      const tokenValue = tokenHash || token;

      if (tokenValue && (type === 'recovery' || type === 'invite')) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenValue,
            type: 'recovery'
          });

          if (error) {
            console.error('Token verification error:', error);
            setIsValidToken(false);
          } else if (data.session) {
            setIsValidToken(true);
            setUserId(data.session.user.id);
          } else {
            setIsValidToken(false);
          }
        } catch (err) {
          console.error('Token check error:', err);
          setIsValidToken(false);
        }
      } else {
        setIsValidToken(false);
      }
    }
    checkToken();
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků');
      return;
    }

    if (password !== confirmPassword) {
      setError('Hesla se neshodují');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      if (userId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (!profile || !profile.first_name || !profile.last_name) {
          setNeedsProfileSetup(true);
          setStep('profile');
          setLoading(false);
          return;
        }
      }

      setStep('complete');

      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.hash = '';
        window.location.href = '/?password_changed=true';
      }, 2000);
    } catch (err) {
      setError('Došlo k chybě při nastavování hesla');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Jméno a příjmení jsou povinné');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = '';

      if (avatarFile && userId) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${userId}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      const { error: updateError } = await supabase
        .from('user_roles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_url: avatarUrl || null
        })
        .eq('user_id', userId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setStep('complete');

      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.hash = '';
        window.location.href = '/?password_changed=true';
      }, 2000);
    } catch (err) {
      setError('Došlo k chybě při nastavování profilu');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  if (isValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 webfusion-gradient">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#239a93' }}></div>
            <p className="mt-4 text-gray-600">Načítání...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 webfusion-gradient">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-8 bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg inline-block">
              <img
                src="https://webfusion.io/wp-content/uploads/2021/02/webfusion-logo-white-com.png"
                alt="Webfusion Logo"
                className="h-10 object-contain"
              />
            </div>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyIcon className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Neplatný odkaz</h1>
            <p className="text-gray-600 mb-6">
              Odkaz pro nastavení hesla je neplatný nebo vypršel. Platnost odkazu je 60 minut.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 text-white rounded-lg transition-colors font-medium webfusion-button"
            >
              Zpět na přihlášení
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 webfusion-gradient">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-8 bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg inline-block">
              <img
                src="https://webfusion.io/wp-content/uploads/2021/02/webfusion-logo-white-com.png"
                alt="Webfusion Logo"
                className="h-10 object-contain"
              />
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8f7f6' }}>
              <CheckCircleIcon className="w-8 h-8" style={{ color: '#239a93' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>
              {needsProfileSetup ? 'Profil dokončen' : 'Heslo změněno'}
            </h1>
            <p className="text-gray-600 mb-6">
              {needsProfileSetup
                ? 'Váš profil byl úspěšně nastaven. Nyní se můžete přihlásit.'
                : 'Vaše heslo bylo úspěšně změněno. Nyní se můžete přihlásit s novým heslem.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'profile') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 webfusion-gradient">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-8 bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg inline-block">
              <img
                src="https://webfusion.io/wp-content/uploads/2021/02/webfusion-logo-white-com.png"
                alt="Webfusion Logo"
                className="h-10 object-contain"
              />
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8f7f6' }}>
              <UserIcon className="w-8 h-8" style={{ color: '#239a93' }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>Dokončete svůj profil</h1>
            <p className="text-gray-600">
              Vyplňte prosím své základní údaje
            </p>
          </div>

          <form onSubmit={handleProfileSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jméno *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Zadejte vaše jméno"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': '#239a93' } as React.CSSProperties}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Příjmení *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Zadejte vaše příjmení"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': '#239a93' } as React.CSSProperties}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profilová fotka (volitelné)
              </label>
              <div className="flex items-center gap-4">
                {avatarPreview && (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-600">
                      {avatarFile ? avatarFile.name : 'Vybrat obrázek'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium webfusion-button"
            >
              {loading ? 'Ukládám...' : 'Dokončit nastavení'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 webfusion-gradient">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-8 bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg inline-block">
            <img
              src="https://webfusion.io/wp-content/uploads/2021/02/webfusion-logo-white-com.png"
              alt="Webfusion Logo"
              className="h-10 object-contain"
            />
          </div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8f7f6' }}>
            <KeyIcon className="w-8 h-8" style={{ color: '#239a93' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#333' }}>Nastavit nové heslo</h1>
          <p className="text-gray-600">
            Vytvořte si silné heslo pro přístup do systému
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nové heslo
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Zadejte nové heslo (min. 6 znaků)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-10"
                style={{ '--tw-ring-color': '#239a93' } as React.CSSProperties}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Potvrďte heslo
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Zadejte heslo znovu"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              style={{ '--tw-ring-color': '#239a93' } as React.CSSProperties}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium webfusion-button"
          >
            {loading ? 'Nastavuji heslo...' : 'Nastavit heslo'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Odkaz pro nastavení hesla je platný 60 minut</p>
        </div>
      </div>
    </div>
  );
}