export default function StatePanel({ title, children, error = false, action }) {
  return (
    <div className="state-panel" role={error ? 'alert' : 'status'}>
      <h2>{title}</h2>
      {children && <p className={error ? 'error-message' : ''}>{children}</p>}
      {action}
    </div>
  )
}
