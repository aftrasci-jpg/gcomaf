import { db } from '../firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { authAdminService } from './auth-admin.js';

/**
 * Service de gestion des formulaires de prospection
 * Gère la création, modification et suppression des formulaires
 */

export class FormsService {
  constructor() {
    this.collectionName = 'prospection_forms';
  }

  /**
   * Crée un nouveau formulaire de prospection
   */
  async createForm(title, description, fields) {
    try {
      await authAdminService.checkPermission('create_forms');

      // Validation des données
      this.validateFormData(title, description, fields);

      const formData = {
        title,
        description,
        fields,
        isActive: true,
        usageCount: 0,
        createdAt: serverTimestamp(),
        createdBy: authAdminService.getCurrentUserId(),
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      };

      const docRef = await addDoc(collection(db, this.collectionName), formData);

      // Log d'audit
      await authAdminService.logAuditAction('create_form', {
        formId: docRef.id,
        title,
        fieldCount: fields.length
      });

      return {
        id: docRef.id,
        ...formData
      };

    } catch (error) {
      await authAdminService.logAuditAction('create_form_failed', {
        title,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Récupère tous les formulaires
   */
  async getAllForms() {
    try {
      await authAdminService.checkPermission('view_forms');

      const formsQuery = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const formsSnapshot = await getDocs(formsQuery);

      const forms = [];
      formsSnapshot.forEach((docSnap) => {
        const formData = docSnap.data();
        forms.push({
          id: docSnap.id,
          ...formData,
          createdAt: formData.createdAt?.toDate?.() || new Date(formData.createdAt),
          lastModified: formData.lastModified?.toDate?.() || new Date(formData.lastModified)
        });
      });

      return forms;
    } catch (error) {
      console.error('Erreur lors de la récupération des formulaires:', error);
      throw new Error('Impossible de récupérer la liste des formulaires');
    }
  }

  /**
   * Récupère un formulaire par ID
   */
  async getFormById(formId) {
    try {
      await authAdminService.checkPermission('view_forms');

      const formDoc = await getDoc(doc(db, this.collectionName, formId));

      if (!formDoc.exists()) {
        throw new Error('Formulaire non trouvé');
      }

      const formData = formDoc.data();
      return {
        id: formDoc.id,
        ...formData,
        createdAt: formData.createdAt?.toDate?.() || new Date(formData.createdAt),
        lastModified: formData.lastModified?.toDate?.() || new Date(formData.lastModified)
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du formulaire:', error);
      throw error;
    }
  }

  /**
   * Met à jour un formulaire
   */
  async updateForm(formId, updates) {
    try {
      await authAdminService.checkPermission('update_forms');

      const formRef = doc(db, this.collectionName, formId);
      await updateDoc(formRef, {
        ...updates,
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('update_form', {
        formId,
        updates
      });

    } catch (error) {
      await authAdminService.logAuditAction('update_form_failed', {
        formId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Supprime un formulaire
   */
  async deleteForm(formId) {
    try {
      await authAdminService.checkPermission('delete_forms');

      await deleteDoc(doc(db, this.collectionName, formId));

      // Log d'audit
      await authAdminService.logAuditAction('delete_form', {
        formId
      });

    } catch (error) {
      await authAdminService.logAuditAction('delete_form_failed', {
        formId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Active/désactive un formulaire
   */
  async toggleFormStatus(formId, isActive) {
    try {
      await authAdminService.checkPermission('update_forms');

      const formRef = doc(db, this.collectionName, formId);
      await updateDoc(formRef, {
        isActive,
        lastModified: serverTimestamp(),
        lastModifiedBy: authAdminService.getCurrentUserId()
      });

      // Log d'audit
      await authAdminService.logAuditAction('toggle_form_status', {
        formId,
        isActive
      });

    } catch (error) {
      await authAdminService.logAuditAction('toggle_form_status_failed', {
        formId,
        isActive,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Incrémente le compteur d'utilisation d'un formulaire
   */
  async incrementUsageCount(formId) {
    try {
      const formDoc = await getDoc(doc(db, this.collectionName, formId));
      if (formDoc.exists()) {
        const currentCount = formDoc.data().usageCount || 0;
        await updateDoc(doc(db, this.collectionName, formId), {
          usageCount: currentCount + 1
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'incrémentation du compteur d\'usage:', error);
    }
  }

  /**
   * Obtient les statistiques des formulaires
   */
  async getFormsStats() {
    try {
      const forms = await this.getAllForms();

      const stats = {
        total: forms.length,
        active: forms.filter(f => f.isActive).length,
        inactive: forms.filter(f => !f.isActive).length,
        totalFields: forms.reduce((sum, f) => sum + (f.fields?.length || 0), 0),
        totalUsage: forms.reduce((sum, f) => sum + (f.usageCount || 0), 0),
        averageFields: forms.length > 0 ? Math.round(forms.reduce((sum, f) => sum + (f.fields?.length || 0), 0) / forms.length) : 0
      };

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques des formulaires:', error);
      throw new Error('Impossible de calculer les statistiques des formulaires');
    }
  }

  /**
   * Recherche des formulaires par critères
   */
  async searchForms(criteria) {
    try {
      await authAdminService.checkPermission('search_forms');

      let forms = await this.getAllForms();

      if (criteria.isActive !== undefined) {
        forms = forms.filter(f => f.isActive === criteria.isActive);
      }

      if (criteria.searchTerm) {
        const term = criteria.searchTerm.toLowerCase();
        forms = forms.filter(f =>
          f.title.toLowerCase().includes(term) ||
          f.description.toLowerCase().includes(term)
        );
      }

      // Filtrage par période
      if (criteria.dateFrom) {
        const fromDate = new Date(criteria.dateFrom);
        forms = forms.filter(f => f.createdAt >= fromDate);
      }

      if (criteria.dateTo) {
        const toDate = new Date(criteria.dateTo);
        toDate.setHours(23, 59, 59, 999);
        forms = forms.filter(f => f.createdAt <= toDate);
      }

      return forms;
    } catch (error) {
      console.error('Erreur lors de la recherche de formulaires:', error);
      throw new Error('Erreur lors de la recherche');
    }
  }

  /**
   * Valide les données d'un formulaire
   */
  validateFormData(title, description, fields) {
    if (!title?.trim()) {
      throw new Error('Le titre du formulaire est obligatoire');
    }
    if (!description?.trim()) {
      throw new Error('La description du formulaire est obligatoire');
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('Au moins un champ est requis');
    }

    // Validation des champs
    fields.forEach((field, index) => {
      if (!field.name?.trim()) {
        throw new Error(`Le nom du champ ${index + 1} est obligatoire`);
      }
      if (!field.label?.trim()) {
        throw new Error(`Le label du champ ${index + 1} est obligatoire`);
      }
      if (!['text', 'email', 'tel', 'textarea'].includes(field.type)) {
        throw new Error(`Type de champ invalide pour le champ ${index + 1}`);
      }
    });

    return true;
  }

  /**
   * Génère le HTML d'un formulaire pour les agents
   */
  generateFormHTML(formData) {
    const { title, description, fields } = formData;

    let html = `
      <div class="prospection-form">
        <h3>${title}</h3>
        <p>${description}</p>
        <form class="prospection-form-fields">
    `;

    fields.forEach(field => {
      html += `
        <div class="form-group mb-3">
          <label for="${field.name}" class="form-label">${field.label}${field.required ? ' *' : ''}</label>
      `;

      switch (field.type) {
        case 'textarea':
          html += `<textarea id="${field.name}" name="${field.name}" class="form-control" ${field.required ? 'required' : ''}></textarea>`;
          break;
        default:
          html += `<input type="${field.type}" id="${field.name}" name="${field.name}" class="form-control" ${field.required ? 'required' : ''}>`;
      }

      html += '</div>';
    });

    html += `
          <button type="submit" class="btn btn-primary">Envoyer la demande</button>
        </form>
      </div>
    `;

    return html;
  }
}

// Instance globale
export const formsService = new FormsService();