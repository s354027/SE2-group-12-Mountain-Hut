import { useEffect, useState } from "react";

export default function RequirementsModal({
  initialRequirement,
  onClose,
  onSave,
  showRequirementsModal,
}) {
  const [description, setDescription] = useState("");
  const [isAllergy, setIsAllergy] = useState(false);

  useEffect(() => {
    if (showRequirementsModal) {
      setDescription(initialRequirement?.description ?? "");
      setIsAllergy(initialRequirement?.isAllergy ?? false);
    }
  }, [initialRequirement, showRequirementsModal]);

  if (!showRequirementsModal) return null;

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription) return;

    onSave({ description: trimmedDescription, isAllergy });
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show d-block requirements-modal"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="requirements-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="requirements-modal-title">
                {initialRequirement ? "Edit requirement" : "Add a requirement"}
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <label
                  htmlFor="booking-requirement-description"
                  className="form-label"
                >
                  Allergy or dietary requirement
                </label>
                <textarea
                  id="booking-requirement-description"
                  name="requirementDescription"
                  className="form-control"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows="3"
                  required
                  placeholder="For example, peanut allergy or vegetarian meal"
                />
                <label
                  className="checkbox-label requirement-allergy-checkbox"
                  htmlFor="booking-requirement-allergy"
                >
                  <input
                    id="booking-requirement-allergy"
                    name="isAllergy"
                    type="checkbox"
                    checked={isAllergy}
                    onChange={(event) => setIsAllergy(event.target.checked)}
                  />
                  This is an allergy (important)
                </label>
                <p className="allergy-notice" role="note">
                  Allergies will be clearly flagged for the hut staff.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!description.trim()}
                >
                  Save requirement
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
