<?php

namespace Database\Seeders;

use App\Models\Courrier;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Crée des courriers de démonstration (enregistre_par = admin ou premier SUPER_ADMIN).
 * À exécuter après DatabaseSeeder pour avoir des courriers visibles dans la liste.
 */
class CourrierSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->first()
            ?? User::where('role', 'SUPER_ADMIN')->first();

        if (!$admin) {
            $this->command->warn('Aucun utilisateur admin trouvé. Exécutez d\'abord DatabaseSeeder.');
            return;
        }

        $now = now();
        $year = $now->format('Y');

        $demos = [
            [
                'numero' => 'EXT-' . $year . '-0001',
                'type' => 'EXTERNE',
                'expediteur' => 'Ministère des Finances',
                'destinataire' => 'Direction Administrative',
                'objet' => 'Demande de pièces comptables 2024',
                'priorite' => 'HAUTE',
                'statut' => 'ENREGISTRE',
                'direction' => 'Direction Administrative',
                'service' => 'Service Comptabilité',
            ],
            [
                'numero' => 'EXT-' . $year . '-0002',
                'type' => 'EXTERNE',
                'expediteur' => 'Client SA',
                'destinataire' => 'Service Commercial',
                'objet' => 'Commande n° 2024-0892',
                'priorite' => 'NORMALE',
                'statut' => 'ENREGISTRE',
                'direction' => 'Direction Commerciale',
                'service' => 'Service Logistique',
            ],
            [
                'numero' => 'INT-' . $year . '-0001',
                'type' => 'INTERNE',
                'expediteur' => 'Direction des Ressources Humaines',
                'destinataire' => 'Division Informatique',
                'objet' => 'Demande d\'équipement pour nouvel agent',
                'priorite' => 'NORMALE',
                'statut' => 'ENREGISTRE',
                'direction' => 'Direction Technique',
                'service' => 'Division Informatique',
            ],
            [
                'numero' => 'EXT-' . $year . '-0003',
                'type' => 'EXTERNE',
                'expediteur' => 'Cabinet Juridique Dupont',
                'destinataire' => 'Direction Générale',
                'objet' => 'Avis juridique - contrat cadre',
                'priorite' => 'URGENTE',
                'statut' => 'EN_ATTENTE_DG',
                'direction' => null,
                'service' => null,
            ],
            [
                'numero' => 'INT-' . $year . '-0002',
                'type' => 'INTERNE',
                'expediteur' => 'Service Comptabilité',
                'destinataire' => 'Direction Financière',
                'objet' => 'Rapport mensuel de trésorerie',
                'priorite' => 'NORMALE',
                'statut' => 'TRAITE',
                'direction' => 'Direction Financière',
                'service' => 'Service Comptabilité',
            ],
        ];

        foreach ($demos as $i => $data) {
            $dateReception = $now->copy()->subDays(rand(1, 30));
            Courrier::updateOrCreate(
                ['numero' => $data['numero']],
                array_merge($data, [
                    'date_reception' => $dateReception,
                    'date_enregistrement' => $dateReception,
                    'enregistre_par' => $admin->id,
                ])
            );
        }

        $this->command->info('Courriers de démo créés : ' . count($demos));
    }
}
