import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiErrorStatus, apiErrorMessage } from '../../api/client'
import './Login.css'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(() =>
    searchParams.get('expired') === '1' ? 'Votre session a expiré. Veuillez vous reconnecter.' : '',
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorMessage('')

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Veuillez remplir tous les champs.')
      return
    }

    setLoading(true)

    try {
      await login({ username: username.trim(), password })
      setLoading(false)
      navigate('/dashboard')
    } catch (error: unknown) {
      setLoading(false)

      const status = apiErrorStatus(error)

      if (status === 401 || status === 403) {
        setErrorMessage('Nom d’utilisateur ou mot de passe incorrect.')
      } else if (status === 0) {
        setErrorMessage('Impossible de contacter le serveur. Vérifiez que le backend est démarré.')
      } else {
        setErrorMessage(apiErrorMessage(error, 'Une erreur est survenue pendant la connexion.'))
      }
    }
  }

  return (
    <div className="screen-login">
      <div className="login-card">
        <div className="login-mark">JC</div>

        <div className="login-title">
          <h1>Connexion</h1>
          <p className="sub">Accès réservé au bureau de l'AJC MAKINA</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Identifiant</label>
            <input
              id="username"
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nom d'utilisateur"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                aria-label="Afficher ou masquer le mot de passe"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="banner error">
              <span>{errorMessage}</span>
            </div>
          )}

          <button type="submit" className="btn-gold login-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                <span>Connexion...</span>
              </>
            ) : (
              <span>Se connecter</span>
            )}
          </button>

          <p className="login-foot">Mot de passe oublié&nbsp;? Contactez l'administrateur.</p>
        </form>
      </div>
    </div>
  )
}
