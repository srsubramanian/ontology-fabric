from __future__ import annotations

import re
import sys
from datetime import (
    date,
    datetime,
    time
)
from decimal import Decimal
from enum import Enum
from typing import (
    Any,
    ClassVar,
    Literal,
    Optional,
    Union
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    RootModel,
    SerializationInfo,
    SerializerFunctionWrapHandler,
    field_validator,
    model_serializer
)


metamodel_version = "1.11.0"
version = "1.10.0"


class ConfiguredBaseModel(BaseModel):
    model_config = ConfigDict(
        serialize_by_alias = True,
        validate_by_name = True,
        validate_assignment = True,
        validate_default = True,
        extra = "forbid",
        arbitrary_types_allowed = True,
        use_enum_values = True,
        strict = False,
    )





class LinkMLMeta(RootModel):
    root: dict[str, Any] = {}
    model_config = ConfigDict(frozen=True)

    def __getattr__(self, key:str):
        return getattr(self.root, key)

    def __getitem__(self, key:str):
        return self.root[key]

    def __setitem__(self, key:str, value):
        self.root[key] = value

    def __contains__(self, key:str) -> bool:
        return key in self.root


linkml_meta = LinkMLMeta({'annotations': {'commons_release': {'tag': 'commons_release',
                                         'value': 'https://www.omg.org/spec/Commons/20250801/'},
                     'fibo_release': {'tag': 'fibo_release',
                                      'value': 'https://spec.edmcouncil.org/fibo/ontology/master/2026Q2/'}},
     'default_prefix': 'pay',
     'default_range': 'string',
     'id': 'https://ontology.example.com/payments',
     'imports': ['linkml:types'],
     'name': 'payments',
     'prefixes': {'cmns-doc': {'prefix_prefix': 'cmns-doc',
                               'prefix_reference': 'https://www.omg.org/spec/Commons/Documents/'},
                  'cmns-org': {'prefix_prefix': 'cmns-org',
                               'prefix_reference': 'https://www.omg.org/spec/Commons/Organizations/'},
                  'cmns-pts': {'prefix_prefix': 'cmns-pts',
                               'prefix_reference': 'https://www.omg.org/spec/Commons/PartiesAndSituations/'},
                  'fibo-be-fct-fct': {'prefix_prefix': 'fibo-be-fct-fct',
                                      'prefix_reference': 'https://spec.edmcouncil.org/fibo/ontology/BE/FunctionalEntities/FunctionalEntities/'},
                  'fibo-fbc-fct-usjrga': {'prefix_prefix': 'fibo-fbc-fct-usjrga',
                                          'prefix_reference': 'https://spec.edmcouncil.org/fibo/ontology/FBC/FunctionalEntities/NorthAmericanEntities/USRegulatoryAgencies/'},
                  'fibo-fbc-fi-stl': {'prefix_prefix': 'fibo-fbc-fi-stl',
                                      'prefix_reference': 'https://spec.edmcouncil.org/fibo/ontology/FBC/FinancialInstruments/Settlement/'},
                  'fibo-fnd-aap-ppl': {'prefix_prefix': 'fibo-fnd-aap-ppl',
                                       'prefix_reference': 'https://spec.edmcouncil.org/fibo/ontology/FND/AgentsAndPeople/People/'},
                  'fibo-loan-spc-crd': {'prefix_prefix': 'fibo-loan-spc-crd',
                                        'prefix_reference': 'https://spec.edmcouncil.org/fibo/ontology/LOAN/LoansSpecific/CardAccounts/'},
                  'iso20022': {'prefix_prefix': 'iso20022',
                               'prefix_reference': 'urn:iso:std:iso:20022:tech:xsd:'},
                  'linkml': {'prefix_prefix': 'linkml',
                             'prefix_reference': 'https://w3id.org/linkml/'},
                  'pay': {'prefix_prefix': 'pay',
                          'prefix_reference': 'https://ontology.example.com/payments/'}},
     'source_file': 'ontology/payments.yaml',
     'title': 'Payments ontology (illustrative draft)'} )

class CardNetwork(str, Enum):
    """
    Card networks whose rules the ontology covers.
    """
    visa = "visa"
    mastercard = "mastercard"


class Channel(str, Enum):
    """
    How the card took part in a payment.
    """
    card_present = "card_present"
    card_not_present = "card_not_present"


class AuthorizationType(str, Enum):
    """
    What an authorization's amount means. Visa names estimated and incremental authorizations; Mastercard names preauthorizations, undefined and final authorizations.
    """
    final = "final"
    """
    The amount is final, and the payment will be captured for it.
    """
    estimated = "estimated"
    """
    The final amount isn't known yet, such as at a hotel or car rental. Mastercard calls it a preauthorization.
    """
    incremental = "incremental"
    """
    An increase to an earlier estimated authorization.
    """
    undefined = "undefined"
    """
    Neither final nor an estimate, in Mastercard's terms.
    """


class Initiator(str, Enum):
    """
    Who started a payment, under the networks' stored-credential rules.
    """
    cardholder = "cardholder"
    """
    The cardholder took part, such as at a checkout.
    """
    merchant = "merchant"
    """
    The merchant charged a card it keeps on file, under an agreement with the cardholder.
    """


class StandingInstruction(str, Enum):
    """
    The agreement a merchant-initiated payment follows.
    """
    recurring = "recurring"
    """
    Regular charges, such as a subscription.
    """
    installment = "installment"
    """
    A set number of payments for one purchase.
    """
    unscheduled = "unscheduled"
    """
    Charges at no fixed time, such as a top-up when a balance runs low.
    """


class Decider(str, Enum):
    """
    Who answered an authorization.
    """
    issuer = "issuer"
    """
    The issuer, or its processor, decided.
    """
    network_stand_in = "network_stand_in"
    """
    The network's stand-in processing answered for the issuer, such as Visa's STIP.
    """
    processor_stand_in = "processor_stand_in"
    """
    The issuer's processor answered with its own stand-in rules.
    """


class Credential(str, Enum):
    """
    What stood in for the card number in an authorization.
    """
    pan = "pan"
    """
    The card number itself.
    """
    card_on_file_token = "card_on_file_token"
    """
    A network token a merchant or processor keeps on file.
    """
    wallet_token = "wallet_token"
    """
    A network token held in a digital wallet, such as a phone's.
    """


class FundingSource(str, Enum):
    """
    Where the money behind a card comes from, as networks' BIN tables report it.
    """
    credit = "credit"
    """
    A line of credit.
    """
    debit = "debit"
    """
    A deposit account.
    """
    prepaid = "prepaid"
    """
    Funds loaded onto the card in advance.
    """


class AuthenticationResult(str, Enum):
    """
    How a cardholder authentication ended, following EMV 3-D Secure's final transaction status.
    """
    authenticated = "authenticated"
    """
    The cardholder was verified (status Y).
    """
    attempted = "attempted"
    """
    Not verified, but proof of an attempt is provided (status A).
    """
    not_authenticated = "not_authenticated"
    """
    Not verified, and the transaction is denied (status N).
    """
    rejected = "rejected"
    """
    The issuer rejected it and asks that no authorization be attempted (status R).
    """
    unavailable = "unavailable"
    """
    It couldn't be performed, for a technical or other reason (status U).
    """


class DisputeSide(str, Enum):
    """
    The two sides of a card dispute. Each bank stands in for its customer.
    """
    issuer = "issuer"
    """
    The issuer, for its cardholder.
    """
    acquirer = "acquirer"
    """
    The acquirer, for its merchant.
    """


class DisputeClosure(str, Enum):
    """
    How a dispute ended.
    """
    accepted = "accepted"
    """
    One side accepted the other's last step.
    """
    withdrawn = "withdrawn"
    """
    The issuer withdrew the dispute, often because its cardholder did.
    """
    ruled = "ruled"
    """
    The card network ruled in arbitration.
    """
    timed_out = "timed_out"
    """
    A side missed its deadline, so the dispute went against it.
    """


class DocumentKind(str, Enum):
    """
    Kinds of document the platform indexes.
    """
    network_rules = "network_rules"
    runbook = "runbook"
    evidence = "evidence"


class VisaReasonCode(str, Enum):
    """
    Visa dispute reason codes. Each is loaded as a ReasonCode node.
    """
    number_10FULL_STOP4 = "10.4"
    """
    Other Fraud: Card-Absent Environment
    """
    number_13FULL_STOP1 = "13.1"
    """
    Merchandise/Services Not Received
    """



class Party(ConfiguredBaseModel):
    """
    A person or organization that takes part in payments.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'abstract': True,
         'annotations': {'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['cmns-pts:Party'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    name: Optional[str] = Field(default=None, description="""What people call it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party', 'Merchant', 'Document']} })
    acts_as: Optional[list[str]] = Field(default=None, description="""A party plays a role.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party']} })


class Person(Party):
    """
    An individual, such as a cardholder.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'Maya'},
                         'id_rule': {'tag': 'id_rule', 'value': 'person:{person_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['fibo-fnd-aap-ppl:Person'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    name: Optional[str] = Field(default=None, description="""What people call it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party', 'Merchant', 'Document']} })
    acts_as: Optional[list[str]] = Field(default=None, description="""A party plays a role.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party']} })


class Organization(Party):
    """
    A company or institution. One bank is one Organization, however many roles it plays.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'First Bay Bank'},
                         'id_rule': {'tag': 'id_rule', 'value': 'org:{org_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['cmns-org:Organization'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    name: Optional[str] = Field(default=None, description="""What people call it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party', 'Merchant', 'Document']} })
    acts_as: Optional[list[str]] = Field(default=None, description="""A party plays a role.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party']} })


class PartyRole(ConfiguredBaseModel):
    """
    A role a party plays, such as issuer or merchant. Roles keep one bank from turning into two nodes.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'abstract': True,
         'annotations': {'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['cmns-pts:PartyRole'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Cardholder(PartyRole):
    """
    The person a card is issued to.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'Maya'},
                         'id_rule': {'tag': 'id_rule', 'value': 'ch:{cardholder_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['fibo-loan-spc-crd:Cardholder'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Issuer(PartyRole):
    """
    The bank that issues cards and approves or declines their authorizations.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'First Bay Bank'},
                         'id_rule': {'tag': 'id_rule', 'value': 'iss:{issuer_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['fibo-loan-spc-crd:IssuingFinancialInstitution'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Acquirer(PartyRole):
    """
    The bank that signs up merchants and claims funds for them.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'Coastal Acquiring'},
                         'id_rule': {'tag': 'id_rule', 'value': 'acq:{acquirer_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'FIBO has no acquirer. ISO 20022 '
                                                  'names the acquirer only as a party '
                                                  'inside card messages, with no '
                                                  'identifier of its own.'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Merchant(PartyRole):
    """
    A business that accepts cards, as its acquirer knows it.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['store', 'merchant outlet'],
         'annotations': {'example': {'tag': 'example',
                                     'value': 'm:88213, Harbor Grill #4, MCC 5812'},
                         'id_rule': {'tag': 'id_rule', 'value': 'm:{merchant_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['fibo-be-fct-fct:Merchant'],
         'from_schema': 'https://ontology.example.com/payments'})

    name: Optional[str] = Field(default=None, description="""What people call it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party', 'Merchant', 'Document']} })
    mcc: Optional[str] = Field(default=None, description="""Merchant category code, from ISO 18245.""", json_schema_extra = { "linkml_meta": {'close_mappings': ['fibo-be-fct-fct:MerchantCategoryCode'],
         'domain_of': ['Merchant']} })
    country: Optional[str] = Field(default=None, description="""A country, as an ISO 3166-1 alpha-2 code such as US: where a merchant trades, or where a BIN range is licensed.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Merchant', 'BinRange']} })
    acquired_by: Optional[str] = Field(default=None, description="""A merchant's acquiring bank.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Merchant']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('mcc')
    def pattern_mcc(cls, v):
        pattern=re.compile(r"^\d{4}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid mcc format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid mcc format: {v}"
            raise ValueError(err_msg)
        return v

    @field_validator('country')
    def pattern_country(cls, v):
        pattern=re.compile(r"^[A-Z]{2}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid country format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid country format: {v}"
            raise ValueError(err_msg)
        return v


class Card(ConfiguredBaseModel):
    """
    A payment card, identified by a token rather than its number.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['PAN', 'token'],
         'annotations': {'example': {'tag': 'example', 'value': 'card:tk_1a3'},
                         'id_rule': {'tag': 'id_rule', 'value': 'card:{token}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['fibo-loan-spc-crd:PaymentCard'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    network: Optional[CardNetwork] = Field(default=None, description="""The card network whose rules apply.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Card', 'ReasonCode']} })
    held_by: Optional[str] = Field(default=None, description="""Who a card is issued to.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Card']} })
    in_bin_range: Optional[str] = Field(default=None, description="""The BIN range a card's number falls in.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Card']} })


class BinRange(ConfiguredBaseModel):
    """
    The range of card numbers a bank issues from. A node rather than a string, so authorizations can be grouped by it.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['BIN', 'IIN'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'bin:{prefix}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'authorization'}},
         'close_mappings': ['fibo-fbc-fct-usjrga:IssuerIdentificationNumber'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    prefix: Optional[str] = Field(default=None, description="""The leading digits every card in the range shares.""", json_schema_extra = { "linkml_meta": {'domain_of': ['BinRange']} })
    funding_source: Optional[FundingSource] = Field(default=None, description="""Where the money behind the cards in a BIN range comes from, as the network's BIN table reports it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['BinRange']} })
    country: Optional[str] = Field(default=None, description="""A country, as an ISO 3166-1 alpha-2 code such as US: where a merchant trades, or where a BIN range is licensed.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Merchant', 'BinRange']} })
    assigned_to: Optional[str] = Field(default=None, description="""The issuer a BIN range belongs to.""", json_schema_extra = { "linkml_meta": {'domain_of': ['BinRange']} })

    @field_validator('country')
    def pattern_country(cls, v):
        pattern=re.compile(r"^[A-Z]{2}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid country format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid country format: {v}"
            raise ValueError(err_msg)
        return v


class Device(ConfiguredBaseModel):
    """
    A phone, browser or terminal an authorization came from.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'dev:{device_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'ISO 20022 describes the point of '
                                                  'interaction inside card messages, '
                                                  'with no identifier of its own. FIBO '
                                                  'has no device.'},
                         'owner': {'tag': 'owner', 'value': 'risk'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    seen_at: Optional[list[str]] = Field(default=None, description="""A summary edge, rebuilt daily from Snowflake: the device made authorizations at the merchant. It carries auths, first_seen and last_seen, so risk walks don't need every authorization in the graph (decision 2).""", json_schema_extra = { "linkml_meta": {'annotations': {'edge_properties': {'tag': 'edge_properties',
                                             'value': 'auths:Long, '
                                                      'first_seen:DateTime, '
                                                      'last_seen:DateTime'}},
         'domain_of': ['Device']} })


class PaymentEvent(ConfiguredBaseModel):
    """
    Something that happened to a payment, at a time. Each step is its own event, instead of a status field that keeps being overwritten.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'abstract': True,
         'annotations': {'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Authorization(PaymentEvent):
    """
    The issuer's approval or decline of a payment request.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['auth', 'approval'],
         'annotations': {'example': {'tag': 'example',
                                     'value': 'auth:5521, Aug 3, $42.50, card not '
                                              'present'},
                         'id_rule': {'tag': 'id_rule',
                                     'value': 'auth:{authorization_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'owner': {'tag': 'owner', 'value': 'authorization'}},
         'close_mappings': ['iso20022:cain.001.001.05'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'at_merchant': {'name': 'at_merchant', 'required': True},
                        'has_response': {'name': 'has_response', 'required': True},
                        'with_card': {'name': 'with_card', 'required': True}}})

    authorized_at: Optional[datetime ] = Field(default=None, description="""When the issuer answered.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    approved_amount: Optional[Decimal] = Field(default=None, description="""The amount the issuer approved, when less than the amount requested: a partial approval.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    channel: Optional[Channel] = Field(default=None, description="""Whether the card was present.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    authorization_type: Optional[AuthorizationType] = Field(default=None, description="""Whether an authorization's amount is final, an estimate, or an increase to an earlier estimate.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    credential: Optional[Credential] = Field(default=None, description="""What stood in for the card number in an authorization.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    token_requestor: Optional[str] = Field(default=None, description="""The Token Requestor ID of the wallet or merchant a network token was issued to: 11 digits, assigned under EMVCo's payment tokenisation.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    initiated_by: Optional[Initiator] = Field(default=None, description="""Who started the payment, under the networks' stored-credential rules: the cardholder, or the merchant using a card it keeps on file.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    standing_instruction: Optional[StandingInstruction] = Field(default=None, description="""The agreement a merchant-initiated payment follows, such as a subscription.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    decided_by: Optional[Decider] = Field(default=None, description="""Who answered the authorization: the issuer, or stand-in processing answering for an issuer that couldn't.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    at_merchant: str = Field(default=..., description="""Where an authorization was requested.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    with_card: str = Field(default=..., description="""The card an authorization used.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    from_device: Optional[str] = Field(default=None, description="""The device an authorization came from.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    has_response: str = Field(default=..., description="""The issuer's answer to an authorization.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    authenticated_by: Optional[str] = Field(default=None, description="""The authentication an authorization relied on.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    increments: Optional[str] = Field(default=None, description="""The earlier authorization an incremental authorization adds to.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v

    @field_validator('token_requestor')
    def pattern_token_requestor(cls, v):
        pattern=re.compile(r"^\d{11}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid token_requestor format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid token_requestor format: {v}"
            raise ValueError(err_msg)
        return v


class Authentication(PaymentEvent):
    """
    The issuer checking that the cardholder is who they say, before an authorization, such as a 3-D Secure attempt.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['3-D Secure', '3DS', 'cardholder authentication'],
         'annotations': {'id_rule': {'tag': 'id_rule',
                                     'value': 'authn:{authentication_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': '3-D Secure is an EMVCo protocol. No '
                                                  'ISO 20022 message or FIBO concept '
                                                  'stands for an authentication on its '
                                                  'own.'},
                         'owner': {'tag': 'owner', 'value': 'authorization'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'authentication_result': {'name': 'authentication_result',
                                                  'required': True}}})

    authenticated_at: Optional[datetime ] = Field(default=None, description="""When the cardholder was authenticated.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authentication']} })
    authentication_result: AuthenticationResult = Field(default=..., description="""How an authentication ended, as EMV 3-D Secure's final transaction status reports it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authentication']} })
    challenged: Optional[bool] = Field(default=None, description="""Whether the issuer challenged the cardholder, such as with a one-time code, rather than letting the payment through without friction.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authentication']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Reversal(PaymentEvent):
    """
    The acquirer cancelling all or part of an authorization, so the issuer releases the hold on the cardholder's funds.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['authorization reversal'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'rev:{reversal_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'owner': {'tag': 'owner', 'value': 'authorization'}},
         'close_mappings': ['iso20022:cain.005.001.05'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'reverses': {'name': 'reverses', 'required': True}}})

    reversed_at: Optional[datetime ] = Field(default=None, description="""When the acquirer sent the reversal.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Reversal']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    reverses: str = Field(default=..., description="""The authorization a reversal cancels.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Reversal']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class Capture(PaymentEvent):
    """
    The merchant claiming the funds an authorization approved.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['clearing', 'presentment'],
         'annotations': {'example': {'tag': 'example',
                                     'value': 'cap:7731, Aug 4, $42.50'},
                         'id_rule': {'tag': 'id_rule', 'value': 'cap:{capture_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'owner': {'tag': 'owner', 'value': 'settlement'}},
         'close_mappings': ['iso20022:cain.003.001.05'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'captures': {'name': 'captures', 'required': True}}})

    captured_at: Optional[datetime ] = Field(default=None, description="""When the merchant claimed the funds.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Capture']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    captures: str = Field(default=..., description="""The authorization a capture claims funds for.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Capture']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class Settlement(PaymentEvent):
    """
    Funds moving between the banks for a batch of captures.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'stl:{settlement_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'owner': {'tag': 'owner', 'value': 'settlement'}},
         'close_mappings': ['fibo-fbc-fi-stl:SettlementEvent'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'settles': {'name': 'settles', 'required': True}}})

    settled_at: Optional[datetime ] = Field(default=None, description="""When the funds moved.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Settlement']} })
    settles: list[str] = Field(default=..., description="""The captures a settlement pays out.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Settlement']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class Refund(PaymentEvent):
    """
    The merchant returning all or part of a captured amount.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['credit'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'rf:{refund_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'warehouse'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'ISO 20022 sends a refund as a '
                                                  'financial message with a refund '
                                                  'transaction type, so no message '
                                                  'stands for refunds alone.'},
                         'owner': {'tag': 'owner', 'value': 'settlement'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'refunds': {'name': 'refunds', 'required': True}}})

    refunded_at: Optional[datetime ] = Field(default=None, description="""When the refund was made.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Refund']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    refunds: str = Field(default=..., description="""The capture a refund returns money from.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Refund']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class FraudReport(PaymentEvent):
    """
    An issuer reporting an authorization as fraud to the network.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['TC40', 'SAFE report'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'fr:{report_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'risk'}},
         'close_mappings': ['iso20022:cafr.001.001.04'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'reports': {'name': 'reports', 'required': True}}})

    reported_at: Optional[datetime ] = Field(default=None, description="""When the fraud was reported.""", json_schema_extra = { "linkml_meta": {'domain_of': ['FraudReport']} })
    reports: str = Field(default=..., description="""The authorization a fraud report is about.""", json_schema_extra = { "linkml_meta": {'domain_of': ['FraudReport']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })


class DisputeEvent(PaymentEvent):
    """
    A step in a dispute over a captured transaction. Each step carries the amount in dispute and, while it waits for an answer, the date the other side must respond by.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'abstract': True,
         'annotations': {'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments'})

    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: Optional[str] = Field(default=None, description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: Optional[str] = Field(default=None, description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class RetrievalRequest(DisputeEvent):
    """
    The issuer asking the acquirer for the original transaction details, often before it decides whether to dispute.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['copy request', 'request for copy'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'rr:{retrieval_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'close_mappings': ['iso20022:cain.021.001.04'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'disputes': {'name': 'disputes', 'required': True}}})

    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: str = Field(default=..., description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: Optional[str] = Field(default=None, description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class Chargeback(DisputeEvent):
    """
    A dispute event in which the issuer, through the card network, reverses all or part of a captured transaction for the cardholder.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['CB', 'chargeback case'],
         'annotations': {'example': {'tag': 'example',
                                     'value': 'cb:1001, Aug 19, reason 10.4, $42.50'},
                         'id_rule': {'tag': 'id_rule', 'value': 'cb:{chargeback_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'close_mappings': ['iso20022:cain.027.001.04'],
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'amount': {'name': 'amount', 'required': True},
                        'currency': {'name': 'currency', 'required': True},
                        'disputes': {'name': 'disputes', 'required': True},
                        'has_reason': {'name': 'has_reason', 'required': True},
                        'opened_at': {'name': 'opened_at', 'required': True}},
         'title': 'Chargeback'})

    opened_at: datetime  = Field(default=..., description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Decimal = Field(default=..., description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: str = Field(default=..., description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: str = Field(default=..., description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: list[str] = Field(default=..., description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: Optional[str] = Field(default=None, description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class Representment(DisputeEvent):
    """
    The merchant's response to a chargeback, with its evidence.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['second presentment', 'merchant response'],
         'annotations': {'id_rule': {'tag': 'id_rule',
                                     'value': 'rep:{representment_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': "ISO 20022's chargeback response "
                                                  '(cain.028) answers a chargeback, '
                                                  'but whether it carries the '
                                                  "merchant's evidence isn't confirmed "
                                                  'yet.'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'responds_to': {'name': 'responds_to', 'required': True}}})

    has_evidence: Optional[list[str]] = Field(default=None, description="""Documents sent as evidence.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Representment']} })
    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: Optional[str] = Field(default=None, description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: str = Field(default=..., description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class PreArbitration(DisputeEvent):
    """
    Issuer challenges the merchant's response before arbitration.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['pre-arb'],
         'annotations': {'id_rule': {'tag': 'id_rule',
                                     'value': 'parb:{pre_arbitration_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'Pre-arbitration is a card network '
                                                  'rule, with no ISO 20022 message or '
                                                  'FIBO concept of its own.'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'responds_to': {'name': 'responds_to', 'required': True}}})

    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: Optional[str] = Field(default=None, description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: str = Field(default=..., description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class Arbitration(DisputeEvent):
    """
    Either side asking the card network to decide a dispute that pre-arbitration didn't settle. The network's ruling is binding.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['arbitration case'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'arb:{arbitration_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'Arbitration is a card network rule, '
                                                  'with no ISO 20022 message or FIBO '
                                                  'concept of its own.'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'responds_to': {'name': 'responds_to', 'required': True}}})

    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: Optional[str] = Field(default=None, description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: str = Field(default=..., description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class DisputeOutcome(DisputeEvent):
    """
    The event that closes a dispute: which side won, how it ended, and the amount that finally went back to the cardholder. It answers the dispute's last step, and links to the disputed capture, as the chargeback does.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['dispute resolution', 'case closure'],
         'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'out:{outcome_id}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'The ISO 20022 card messages carry '
                                                  'the steps of a dispute, but none '
                                                  'stands for its outcome. Networks '
                                                  'record it in their own case '
                                                  'systems.'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments',
         'slot_usage': {'closure': {'name': 'closure', 'required': True},
                        'disputes': {'name': 'disputes', 'required': True},
                        'responds_to': {'name': 'responds_to', 'required': True},
                        'won_by': {'name': 'won_by', 'required': True}}})

    won_by: DisputeSide = Field(default=..., description="""The side a dispute ended in favor of.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeOutcome']} })
    closure: DisputeClosure = Field(default=..., description="""How a dispute ended.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeOutcome']} })
    opened_at: Optional[datetime ] = Field(default=None, description="""When the dispute step began.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    respond_by: Optional[datetime ] = Field(default=None, description="""When the other side must answer this step by, under the network's rules for the stage. Missing it decides the dispute against that side.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    amount: Optional[Decimal] = Field(default=None, description="""The amount, in the transaction currency.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    currency: Optional[str] = Field(default=None, description="""The transaction currency, as an ISO 4217 alphabetic code such as USD.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Authorization',
                       'Reversal',
                       'Capture',
                       'Refund',
                       'DisputeEvent']} })
    disputes: str = Field(default=..., description="""Links a dispute event to the capture it contests.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    has_reason: Optional[list[str]] = Field(default=None, description="""The network reason codes behind a dispute.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    responds_to: str = Field(default=..., description="""The earlier dispute event this one answers.""", json_schema_extra = { "linkml_meta": {'domain_of': ['DisputeEvent']} })
    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })

    @field_validator('currency')
    def pattern_currency(cls, v):
        pattern=re.compile(r"^[A-Z]{3}$")
        if isinstance(v, list):
            for element in v:
                if isinstance(element, str) and not pattern.match(element):
                    err_msg = f"Invalid currency format: {element}"
                    raise ValueError(err_msg)
        elif isinstance(v, str) and not pattern.match(v):
            err_msg = f"Invalid currency format: {v}"
            raise ValueError(err_msg)
        return v


class ReasonCode(ConfiguredBaseModel):
    """
    A network's reason for a dispute. A node, so chargebacks and the documents that explain the code meet at one place.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'aliases': ['dispute reason'],
         'annotations': {'code_list': {'tag': 'code_list', 'value': 'VisaReasonCode'},
                         'example': {'tag': 'example',
                                     'value': 'rc:visa:10.4, Other Fraud: Card-Absent '
                                              'Environment'},
                         'id_rule': {'tag': 'id_rule', 'value': 'rc:{network}:{code}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'Each card network publishes its own '
                                                  'dispute reason codes; no ISO list '
                                                  'covers them.'},
                         'owner': {'tag': 'owner', 'value': 'disputes'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    network: Optional[CardNetwork] = Field(default=None, description="""The card network whose rules apply.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Card', 'ReasonCode']} })
    code: Optional[str] = Field(default=None, description="""The code as the network or issuer writes it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['ReasonCode', 'ResponseCode']} })


class ResponseCode(ConfiguredBaseModel):
    """
    The issuer's answer code on an authorization, such as approved or declined.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'id_rule': {'tag': 'id_rule', 'value': 'resp:{code}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'graph'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'Response codes come from ISO 8583 '
                                                  "and each network's rules, which "
                                                  'publish no identifiers to map to.'},
                         'owner': {'tag': 'owner', 'value': 'authorization'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    code: Optional[str] = Field(default=None, description="""The code as the network or issuer writes it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['ReasonCode', 'ResponseCode']} })


class Document(ConfiguredBaseModel):
    """
    A network rule book, runbook or piece of evidence. Its text lives in search; Neptune keeps a stub.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'visa-vamp-2026'},
                         'id_rule': {'tag': 'id_rule', 'value': '{doc_slug}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'search'},
                         'owner': {'tag': 'owner', 'value': 'core'}},
         'close_mappings': ['cmns-doc:Document'],
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    name: Optional[str] = Field(default=None, description="""What people call it.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party', 'Merchant', 'Document']} })
    kind: Optional[DocumentKind] = Field(default=None, description="""What sort of document it is.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Document']} })


class Chunk(ConfiguredBaseModel):
    """
    A passage of a document. Its text and embedding live in OpenSearch; the stub in Neptune links it to the entities it mentions.
    """
    linkml_meta: ClassVar[LinkMLMeta] = LinkMLMeta({'annotations': {'example': {'tag': 'example', 'value': 'visa-vamp-2026#c04'},
                         'id_rule': {'tag': 'id_rule', 'value': '{doc_slug}#{chunk}'},
                         'lives_in': {'tag': 'lives_in', 'value': 'search'},
                         'no_standard': {'tag': 'no_standard',
                                         'value': 'A passage of an indexed document is '
                                                  "this platform's own idea."},
                         'owner': {'tag': 'owner', 'value': 'core'},
                         'search_index': {'tag': 'search_index', 'value': 'chunks'}},
         'from_schema': 'https://ontology.example.com/payments'})

    id: str = Field(default=..., description="""The one ID used in Neptune, OpenSearch and Snowflake.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Party',
                       'PartyRole',
                       'Card',
                       'BinRange',
                       'Device',
                       'PaymentEvent',
                       'ReasonCode',
                       'ResponseCode',
                       'Document',
                       'Chunk']} })
    part_of: Optional[str] = Field(default=None, description="""The document a chunk comes from.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Chunk']} })
    mentions: Optional[list[Any]] = Field(default=None, description="""Anything a chunk names, such as a merchant, a reason code or a dispute, so its text links to the graph.""", json_schema_extra = { "linkml_meta": {'domain_of': ['Chunk']} })


# Model rebuild
# see https://pydantic-docs.helpmanual.io/usage/models/#rebuilding-a-model
Party.model_rebuild()
Person.model_rebuild()
Organization.model_rebuild()
PartyRole.model_rebuild()
Cardholder.model_rebuild()
Issuer.model_rebuild()
Acquirer.model_rebuild()
Merchant.model_rebuild()
Card.model_rebuild()
BinRange.model_rebuild()
Device.model_rebuild()
PaymentEvent.model_rebuild()
Authorization.model_rebuild()
Authentication.model_rebuild()
Reversal.model_rebuild()
Capture.model_rebuild()
Settlement.model_rebuild()
Refund.model_rebuild()
FraudReport.model_rebuild()
DisputeEvent.model_rebuild()
RetrievalRequest.model_rebuild()
Chargeback.model_rebuild()
Representment.model_rebuild()
PreArbitration.model_rebuild()
Arbitration.model_rebuild()
DisputeOutcome.model_rebuild()
ReasonCode.model_rebuild()
ResponseCode.model_rebuild()
Document.model_rebuild()
Chunk.model_rebuild()
